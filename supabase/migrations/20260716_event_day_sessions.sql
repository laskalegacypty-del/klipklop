-- Tables for Event Day helper share links
-- Sessions hold the running list; helper_times holds times entered by helpers.
-- Two SECURITY DEFINER functions let unauthenticated helpers read/write without
-- exposing the service role key or needing Vercel API routes.

create table if not exists event_day_sessions (
  id                  uuid        primary key default gen_random_uuid(),
  token               text        unique not null,
  created_by          uuid        references auth.users not null,
  primary_event_id    uuid        references qualifier_events(id),
  secondary_event_id  uuid        references qualifier_events(id),
  is_back_to_back     boolean     not null default false,
  entries             jsonb       not null default '[]'::jsonb,
  selected_entry_keys jsonb       not null default '[]'::jsonb,
  expires_at          timestamptz not null,
  revoked_at          timestamptz,
  created_at          timestamptz not null default now()
);

alter table event_day_sessions enable row level security;

-- Only the creator can read / update / delete their sessions
create policy "eds_owner" on event_day_sessions for all
  using (auth.uid() = created_by);

-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists event_day_helper_times (
  id           uuid        primary key default gen_random_uuid(),
  session_id   uuid        references event_day_sessions(id) on delete cascade not null,
  device_id    text        not null,
  entry_key    text        not null,
  event_id     uuid,
  game         text        not null,
  time         numeric,
  is_nt        boolean     not null default false,
  helper_label text,
  updated_at   timestamptz not null default now(),
  unique(session_id, device_id, entry_key, event_id, game)
);

alter table event_day_helper_times enable row level security;

-- Session owner can read all contributions for their sessions
create policy "edht_owner_read" on event_day_helper_times for select
  using (
    session_id in (
      select id from event_day_sessions where created_by = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- get_event_day_session: called by the helper page (unauthenticated / anon key)
-- Validates token, returns session JSON or {ok: false}.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function get_event_day_session(p_token text)
returns jsonb
language plpgsql
security definer
stable
as $$
declare
  v_session  event_day_sessions%rowtype;
  v_primary  jsonb;
  v_secondary jsonb;
begin
  select * into v_session
  from event_day_sessions
  where token = p_token
    and revoked_at is null
    and expires_at > now()
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  select jsonb_build_object(
    'id', id, 'venue', venue, 'date', date,
    'qualifier_number', qualifier_number, 'event_type', event_type
  )
  into v_primary
  from qualifier_events
  where id = v_session.primary_event_id;

  if v_session.secondary_event_id is not null then
    select jsonb_build_object(
      'id', id, 'venue', venue, 'date', date,
      'qualifier_number', qualifier_number, 'event_type', event_type
    )
    into v_secondary
    from qualifier_events
    where id = v_session.secondary_event_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'session', jsonb_build_object(
      'id',                   v_session.id,
      'token',                v_session.token,
      'is_back_to_back',      v_session.is_back_to_back,
      'entries',              v_session.entries,
      'selected_entry_keys',  v_session.selected_entry_keys,
      'primary_event',        v_primary,
      'secondary_event',      coalesce(v_secondary, 'null'::jsonb)
    )
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- upsert_helper_times: called by the helper page (unauthenticated / anon key)
-- Validates token then upserts the helper's times.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function upsert_helper_times(
  p_token        text,
  p_device_id    text,
  p_helper_label text,
  p_times        jsonb
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_session event_day_sessions%rowtype;
  v_row     record;
  v_time    numeric;
begin
  select * into v_session
  from event_day_sessions
  where token = p_token
    and revoked_at is null
    and expires_at > now()
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  for v_row in (select value from jsonb_array_elements(p_times))
  loop
    v_time := case
      when coalesce((v_row.value->>'is_nt')::boolean, false) then null
      when v_row.value->>'time' is null or v_row.value->>'time' = '' then null
      else (v_row.value->>'time')::numeric
    end;

    insert into event_day_helper_times (
      session_id, device_id, entry_key, event_id, game,
      time, is_nt, helper_label, updated_at
    ) values (
      v_session.id,
      p_device_id,
      v_row.value->>'entry_key',
      (v_row.value->>'event_id')::uuid,
      v_row.value->>'game',
      v_time,
      coalesce((v_row.value->>'is_nt')::boolean, false),
      p_helper_label,
      now()
    )
    on conflict (session_id, device_id, entry_key, event_id, game)
    do update set
      time         = excluded.time,
      is_nt        = excluded.is_nt,
      helper_label = excluded.helper_label,
      updated_at   = excluded.updated_at;
  end loop;

  return jsonb_build_object('ok', true);
end;
$$;
