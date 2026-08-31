-- "View As Rider" staged edits: an admin browsing a rider's real pages under
-- an active profile_access_grants grant can propose changes, but nothing
-- touches the rider's real tables until the rider approves the whole batch.

create table if not exists public.staged_edit_sessions (
  id            uuid        primary key default gen_random_uuid(),
  grant_id      uuid        not null references public.profile_access_grants (id) on delete cascade,
  admin_id      uuid        not null references public.profiles (id) on delete cascade,
  user_id       uuid        not null references public.profiles (id) on delete cascade,
  status        text        not null default 'in_progress'
                   check (status in ('in_progress', 'submitted', 'approved', 'rejected')),
  created_at    timestamptz not null default now(),
  submitted_at  timestamptz,
  decided_at    timestamptz
);

create index if not exists ses_grant_idx  on public.staged_edit_sessions (grant_id);
create index if not exists ses_admin_idx  on public.staged_edit_sessions (admin_id);
create index if not exists ses_user_idx   on public.staged_edit_sessions (user_id);
create index if not exists ses_status_idx on public.staged_edit_sessions (status);

alter table public.staged_edit_sessions enable row level security;

drop policy if exists "ses_select_participant" on public.staged_edit_sessions;
create policy "ses_select_participant"
on public.staged_edit_sessions for select to authenticated
using (auth.uid() = admin_id or auth.uid() = user_id);

drop policy if exists "ses_insert_admin" on public.staged_edit_sessions;
create policy "ses_insert_admin"
on public.staged_edit_sessions for insert to authenticated
with check (
  auth.uid() = admin_id
  and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  and exists (
    select 1 from public.profile_access_grants pag
    where pag.id = grant_id and pag.admin_id = auth.uid() and pag.user_id = staged_edit_sessions.user_id
  )
);

-- Admin can update their own session only while still in progress (to submit it)
drop policy if exists "ses_update_admin_submit" on public.staged_edit_sessions;
create policy "ses_update_admin_submit"
on public.staged_edit_sessions for update to authenticated
using (auth.uid() = admin_id and status = 'in_progress')
with check (auth.uid() = admin_id);

-- Rider can update (approve/reject) only a session submitted to them
drop policy if exists "ses_update_user_decide" on public.staged_edit_sessions;
create policy "ses_update_user_decide"
on public.staged_edit_sessions for update to authenticated
using (auth.uid() = user_id and status = 'submitted')
with check (auth.uid() = user_id);

create table if not exists public.staged_edit_items (
  id          uuid        primary key default gen_random_uuid(),
  session_id  uuid        not null references public.staged_edit_sessions (id) on delete cascade,
  table_name  text        not null,
  operation   text        not null check (operation in ('insert', 'update', 'upsert', 'delete')),
  match       jsonb,
  payload     jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists sei_session_idx on public.staged_edit_items (session_id);

alter table public.staged_edit_items enable row level security;

-- Admin can add/read items for their own in-progress sessions
drop policy if exists "sei_all_admin_in_progress" on public.staged_edit_items;
create policy "sei_all_admin_in_progress"
on public.staged_edit_items for all to authenticated
using (
  exists (
    select 1 from public.staged_edit_sessions ses
    where ses.id = session_id and ses.admin_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.staged_edit_sessions ses
    where ses.id = session_id and ses.admin_id = auth.uid() and ses.status = 'in_progress'
  )
);

-- Rider can read items on any session addressed to them (to review submitted/decided batches)
drop policy if exists "sei_select_user" on public.staged_edit_items;
create policy "sei_select_user"
on public.staged_edit_items for select to authenticated
using (
  exists (
    select 1 from public.staged_edit_sessions ses
    where ses.id = session_id and ses.user_id = auth.uid()
  )
);

-- Applies one submitted session's staged items to the real tables, callable
-- only by the target rider. Explicit per-table handling (no dynamic SQL) —
-- column sets below match the exact payloads the app's own write paths use.
create or replace function public.apply_staged_edit_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session record;
  v_item record;
begin
  select * into v_session from staged_edit_sessions where id = p_session_id;
  if v_session is null then
    raise exception 'Session not found';
  end if;
  if v_session.user_id <> auth.uid() then
    raise exception 'Not authorized';
  end if;
  if v_session.status <> 'submitted' then
    raise exception 'Session is not awaiting approval';
  end if;

  for v_item in
    select * from staged_edit_items where session_id = p_session_id order by created_at asc
  loop

    if v_item.table_name = 'profiles' and v_item.operation = 'update' then
      update profiles set
        rider_name = coalesce(v_item.payload->>'rider_name', rider_name),
        province = coalesce(v_item.payload->>'province', province),
        age_category = coalesce(v_item.payload->>'age_category', age_category),
        scoresheet_name = coalesce(v_item.payload->>'scoresheet_name', scoresheet_name),
        profile_photo_url = coalesce(v_item.payload->>'profile_photo_url', profile_photo_url)
      where id = v_session.user_id;

    elsif v_item.table_name = 'horses' then
      if v_item.operation = 'insert' then
        insert into horses (id, user_id, name)
        values (coalesce((v_item.payload->>'id')::uuid, gen_random_uuid()), v_session.user_id, v_item.payload->>'name');
      elsif v_item.operation = 'update' then
        update horses set
          name = coalesce(v_item.payload->>'name', name),
          breed = coalesce(v_item.payload->>'breed', breed),
          sex = coalesce(v_item.payload->>'sex', sex),
          dob = coalesce(nullif(v_item.payload->>'dob', '')::date, dob),
          birth_year = coalesce(nullif(v_item.payload->>'birth_year', '')::int, birth_year),
          color = coalesce(v_item.payload->>'color', color),
          microchip_or_passport = coalesce(v_item.payload->>'microchip_or_passport', microchip_or_passport)
        where id = (v_item.match->>'id')::uuid and user_id = v_session.user_id;
      elsif v_item.operation = 'delete' then
        delete from horses where id = (v_item.match->>'id')::uuid and user_id = v_session.user_id;
      end if;

    elsif v_item.table_name = 'horse_rider_combos' then
      if v_item.operation = 'insert' then
        insert into horse_rider_combos (id, user_id, horse_id, horse_name, current_level, is_pinned, is_archived)
        values (
          coalesce((v_item.payload->>'id')::uuid, gen_random_uuid()),
          v_session.user_id,
          nullif(v_item.payload->>'horse_id', '')::uuid,
          v_item.payload->>'horse_name',
          coalesce((v_item.payload->>'current_level')::int, 0),
          coalesce((v_item.payload->>'is_pinned')::boolean, false),
          coalesce((v_item.payload->>'is_archived')::boolean, false)
        );
      elsif v_item.operation = 'update' then
        update horse_rider_combos set
          horse_id = case when v_item.payload ? 'horse_id' then nullif(v_item.payload->>'horse_id', '')::uuid else horse_id end,
          horse_name = coalesce(v_item.payload->>'horse_name', horse_name),
          current_level = coalesce((v_item.payload->>'current_level')::int, current_level),
          is_pinned = coalesce((v_item.payload->>'is_pinned')::boolean, is_pinned),
          is_archived = coalesce((v_item.payload->>'is_archived')::boolean, is_archived)
        where user_id = v_session.user_id
          and (
            (v_item.match ? 'id' and id = (v_item.match->>'id')::uuid)
            or (not (v_item.match ? 'id') and v_item.match ? 'user_id')
          );
      elsif v_item.operation = 'delete' then
        delete from horse_rider_combos where id = (v_item.match->>'id')::uuid and user_id = v_session.user_id;
      end if;

    elsif v_item.table_name = 'qualifier_events' and v_item.operation = 'insert' then
      insert into qualifier_events (id, date, venue, province, event_type, qualifier_number, notes)
      values (
        coalesce((v_item.payload->>'id')::uuid, gen_random_uuid()),
        nullif(v_item.payload->>'date', '')::date,
        v_item.payload->>'venue',
        v_item.payload->>'province',
        coalesce(v_item.payload->>'event_type', 'historical_import'),
        nullif(v_item.payload->>'qualifier_number', '')::int,
        v_item.payload->>'notes'
      )
      on conflict (id) do nothing;

    elsif v_item.table_name = 'qualifier_results' then
      if v_item.operation = 'insert' then
        insert into qualifier_results (id, combo_id, event_id, game, time, is_nt, level_entered, level_achieved, penalties)
        select
          coalesce((v_item.payload->>'id')::uuid, gen_random_uuid()),
          (v_item.payload->>'combo_id')::uuid,
          (v_item.payload->>'event_id')::uuid,
          v_item.payload->>'game',
          nullif(v_item.payload->>'time', '')::numeric,
          coalesce((v_item.payload->>'is_nt')::boolean, false),
          coalesce((v_item.payload->>'level_entered')::int, 0),
          nullif(v_item.payload->>'level_achieved', '')::int,
          coalesce((v_item.payload->>'penalties')::int, 0)
        where exists (
          select 1 from horse_rider_combos hrc
          where hrc.id = (v_item.payload->>'combo_id')::uuid and hrc.user_id = v_session.user_id
        );
      elsif v_item.operation = 'update' then
        update qualifier_results set
          time = coalesce(nullif(v_item.payload->>'time', '')::numeric, time),
          is_nt = coalesce((v_item.payload->>'is_nt')::boolean, is_nt),
          level_achieved = coalesce(nullif(v_item.payload->>'level_achieved', '')::int, level_achieved)
        where id = (v_item.match->>'id')::uuid
          and combo_id in (select id from horse_rider_combos where user_id = v_session.user_id);
      elsif v_item.operation = 'delete' then
        delete from qualifier_results
        where combo_id in (select id from horse_rider_combos where user_id = v_session.user_id)
          and (
            (v_item.match ? 'id' and id = (v_item.match->>'id')::uuid)
            or (
              not (v_item.match ? 'id')
              and combo_id = nullif(v_item.match->>'combo_id', '')::uuid
              and event_id = nullif(v_item.match->>'event_id', '')::uuid
            )
          );
      end if;

    elsif v_item.table_name = 'personal_bests' then
      if v_item.operation in ('insert', 'upsert') then
        insert into personal_bests (combo_id, game, best_time, season_year, achieved_at, updated_at)
        select
          (v_item.payload->>'combo_id')::uuid,
          v_item.payload->>'game',
          (v_item.payload->>'best_time')::numeric,
          (v_item.payload->>'season_year')::int,
          coalesce(nullif(v_item.payload->>'achieved_at', '')::timestamptz, now()),
          now()
        where exists (
          select 1 from horse_rider_combos hrc
          where hrc.id = (v_item.payload->>'combo_id')::uuid and hrc.user_id = v_session.user_id
        )
        on conflict (combo_id, game, season_year) do update
          set best_time = excluded.best_time, achieved_at = excluded.achieved_at, updated_at = now();
      elsif v_item.operation = 'delete' then
        delete from personal_bests
        where combo_id = nullif(v_item.match->>'combo_id', '')::uuid
          and (not (v_item.match ? 'game') or game = v_item.match->>'game')
          and (not (v_item.match ? 'season_year') or season_year = (v_item.match->>'season_year')::int)
          and combo_id in (select id from horse_rider_combos where user_id = v_session.user_id);
      end if;

    elsif v_item.table_name = 'event_day_results' and v_item.operation in ('insert', 'upsert') then
      insert into event_day_results (combo_id, event_id, game, time, is_nt, level_entered, level_achieved, run_number, rider_name, horse_name, saved_at)
      select
        (v_item.payload->>'combo_id')::uuid,
        (v_item.payload->>'event_id')::uuid,
        v_item.payload->>'game',
        nullif(v_item.payload->>'time', '')::numeric,
        coalesce((v_item.payload->>'is_nt')::boolean, false),
        coalesce((v_item.payload->>'level_entered')::int, 0),
        nullif(v_item.payload->>'level_achieved', '')::int,
        nullif(v_item.payload->>'run_number', '')::int,
        v_item.payload->>'rider_name',
        v_item.payload->>'horse_name',
        now()
      where exists (
        select 1 from horse_rider_combos hrc
        where hrc.id = (v_item.payload->>'combo_id')::uuid and hrc.user_id = v_session.user_id
      )
      on conflict (combo_id, event_id, game) do update
        set time = excluded.time, is_nt = excluded.is_nt, level_achieved = excluded.level_achieved,
            run_number = excluded.run_number, rider_name = excluded.rider_name,
            horse_name = excluded.horse_name, saved_at = now();

    elsif v_item.table_name = 'horse_reminders' then
      if v_item.operation = 'insert' then
        insert into horse_reminders (
          id, horse_id, user_id, label, due_date, reminder_type, custom_label,
          last_done_date, next_due_date, vet_name, notes, is_primary_course_complete,
          notification_days_before, interval_value, interval_unit, is_done
        )
        select
          coalesce((v_item.payload->>'id')::uuid, gen_random_uuid()),
          (v_item.payload->>'horse_id')::uuid,
          v_session.user_id,
          coalesce(v_item.payload->>'label', v_item.payload->>'custom_label', 'Reminder'),
          coalesce(nullif(v_item.payload->>'due_date', '')::date, nullif(v_item.payload->>'next_due_date', '')::date),
          coalesce(v_item.payload->>'reminder_type', 'custom'),
          v_item.payload->>'custom_label',
          nullif(v_item.payload->>'last_done_date', '')::date,
          coalesce(nullif(v_item.payload->>'next_due_date', '')::date, nullif(v_item.payload->>'due_date', '')::date),
          v_item.payload->>'vet_name',
          v_item.payload->>'notes',
          coalesce((v_item.payload->>'is_primary_course_complete')::boolean, false),
          case when v_item.payload->'notification_days_before' is not null
            then array(select jsonb_array_elements_text(v_item.payload->'notification_days_before'))::int[]
            else array[30, 14, 7, 1] end,
          nullif(v_item.payload->>'interval_value', '')::int,
          v_item.payload->>'interval_unit',
          false
        where exists (select 1 from horses h where h.id = (v_item.payload->>'horse_id')::uuid and h.user_id = v_session.user_id);
      elsif v_item.operation = 'update' then
        update horse_reminders set
          is_done = coalesce((v_item.payload->>'is_done')::boolean, is_done),
          last_done_date = coalesce(nullif(v_item.payload->>'last_done_date', '')::date, last_done_date),
          next_due_date = coalesce(nullif(v_item.payload->>'next_due_date', '')::date, next_due_date),
          due_date = coalesce(nullif(v_item.payload->>'due_date', '')::date, due_date)
        where id = (v_item.match->>'id')::uuid and user_id = v_session.user_id;
      elsif v_item.operation = 'delete' then
        delete from horse_reminders where id = (v_item.match->>'id')::uuid and user_id = v_session.user_id;
      end if;

    elsif v_item.table_name = 'horse_medical_entries' then
      if v_item.operation = 'insert' then
        insert into horse_medical_entries (
          id, horse_id, user_id, type, title, date, notes,
          vital_type, vital_value, vital_text_value, recorded_at, is_abnormal, abnormal_reason
        )
        select
          coalesce((v_item.payload->>'id')::uuid, gen_random_uuid()),
          (v_item.payload->>'horse_id')::uuid,
          v_session.user_id,
          coalesce(v_item.payload->>'type', 'other'),
          coalesce(v_item.payload->>'title', 'Entry'),
          coalesce(nullif(v_item.payload->>'date', '')::date, current_date),
          v_item.payload->>'notes',
          v_item.payload->>'vital_type',
          nullif(v_item.payload->>'vital_value', '')::numeric,
          v_item.payload->>'vital_text_value',
          nullif(v_item.payload->>'recorded_at', '')::timestamptz,
          coalesce((v_item.payload->>'is_abnormal')::boolean, false),
          v_item.payload->>'abnormal_reason'
        where exists (select 1 from horses h where h.id = (v_item.payload->>'horse_id')::uuid and h.user_id = v_session.user_id);
      elsif v_item.operation = 'delete' then
        delete from horse_medical_entries where id = (v_item.match->>'id')::uuid and user_id = v_session.user_id;
      end if;

    elsif v_item.table_name = 'vaccination_log' and v_item.operation = 'insert' then
      insert into vaccination_log (id, horse_id, user_id, vaccination_type, dose_number, date_administered, vet_name, notes)
      select
        coalesce((v_item.payload->>'id')::uuid, gen_random_uuid()),
        (v_item.payload->>'horse_id')::uuid,
        v_session.user_id,
        (v_item.payload->>'vaccination_type')::vaccination_type,
        nullif(v_item.payload->>'dose_number', '')::int,
        coalesce(nullif(v_item.payload->>'date_administered', '')::date, current_date),
        coalesce(v_item.payload->>'vet_name', 'Unspecified'),
        v_item.payload->>'notes'
      where exists (select 1 from horses h where h.id = (v_item.payload->>'horse_id')::uuid and h.user_id = v_session.user_id);

    end if;

  end loop;

  update staged_edit_sessions set status = 'approved', decided_at = now() where id = p_session_id;
end;
$$;

revoke all on function public.apply_staged_edit_session(uuid) from public, anon;
grant execute on function public.apply_staged_edit_session(uuid) to authenticated;
