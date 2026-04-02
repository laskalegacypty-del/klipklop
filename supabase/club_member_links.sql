-- Club/Family role setup:
--   - club_head  : parent or club chair who manages riders
--   - club_member: rider registered under a club (read-only view of own data)
--
-- Relationship model:
--   - club_head sends a link request to a club_member rider
--   - club_member accepts (status → 'accepted')
--   - club_head can then INSERT/UPDATE horses, combos, and times
--     on behalf of that rider (rider keeps ownership via user_id)
--
-- Assumptions:
--   - profiles.id matches auth.uid()
--   - profiles.role is 'club_head' | 'club_member' | 'user' | 'supporter' | 'admin'

-- =========================
-- club_member_links
-- =========================
create table if not exists public.club_member_links (
  id           uuid        primary key default gen_random_uuid(),
  club_head_id uuid        not null references public.profiles (id) on delete cascade,
  rider_id     uuid        not null references public.profiles (id) on delete cascade,
  status       text        not null default 'pending', -- 'pending' | 'accepted' | 'rejected'
  created_at   timestamptz not null default now(),
  constraint unique_club_member unique (club_head_id, rider_id)
);

create index if not exists cml_club_head_idx on public.club_member_links (club_head_id);
create index if not exists cml_rider_idx     on public.club_member_links (rider_id);
create index if not exists cml_status_idx    on public.club_member_links (status);

alter table public.club_member_links enable row level security;

-- Club head or linked rider can read links they are part of
drop policy if exists "cml_select_participant" on public.club_member_links;
create policy "cml_select_participant"
on public.club_member_links
for select
to authenticated
using (
  auth.uid() = club_head_id
  or auth.uid() = rider_id
);

-- Club head can send a request (insert own rows)
drop policy if exists "cml_insert_club_head" on public.club_member_links;
create policy "cml_insert_club_head"
on public.club_member_links
for insert
to authenticated
with check (auth.uid() = club_head_id);

-- Rider can accept or reject (update status on rows where they are the rider)
drop policy if exists "cml_update_rider" on public.club_member_links;
create policy "cml_update_rider"
on public.club_member_links
for update
to authenticated
using (auth.uid() = rider_id)
with check (auth.uid() = rider_id);

-- Club head can remove a link (delete their own rows)
drop policy if exists "cml_delete_club_head" on public.club_member_links;
create policy "cml_delete_club_head"
on public.club_member_links
for delete
to authenticated
using (auth.uid() = club_head_id);

-- Rider can also withdraw from a club (delete rows where they are the rider)
drop policy if exists "cml_delete_rider" on public.club_member_links;
create policy "cml_delete_rider"
on public.club_member_links
for delete
to authenticated
using (auth.uid() = rider_id);

-- =========================
-- Allow club_head to read linked riders' profiles
-- =========================
-- profiles already has a broad select policy (or true) so this is typically covered,
-- but we add an explicit one here for documentation purposes.
-- If your profiles table does NOT have a broad open select, uncomment:
--
-- drop policy if exists "profiles_select_club_head_linked" on public.profiles;
-- create policy "profiles_select_club_head_linked"
-- on public.profiles for select to authenticated
-- using (
--   auth.uid() = id
--   or exists (
--     select 1 from public.club_member_links cml
--     where cml.club_head_id = auth.uid()
--       and cml.rider_id = profiles.id
--       and cml.status = 'accepted'
--   )
-- );

-- =========================
-- Allow club_head to INSERT horses for linked riders
-- =========================
drop policy if exists "horses_insert_club_head" on public.horses;
create policy "horses_insert_club_head"
on public.horses
for insert
to authenticated
with check (
  -- own horse
  auth.uid() = user_id
  -- or inserting on behalf of a linked rider
  or exists (
    select 1
    from public.club_member_links cml
    where cml.club_head_id = auth.uid()
      and cml.rider_id = horses.user_id
      and cml.status = 'accepted'
  )
);

-- =========================
-- Allow club_head to UPDATE horses for linked riders
-- =========================
drop policy if exists "horses_update_club_head" on public.horses;
create policy "horses_update_club_head"
on public.horses
for update
to authenticated
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.club_member_links cml
    where cml.club_head_id = auth.uid()
      and cml.rider_id = horses.user_id
      and cml.status = 'accepted'
  )
)
with check (
  auth.uid() = user_id
  or exists (
    select 1
    from public.club_member_links cml
    where cml.club_head_id = auth.uid()
      and cml.rider_id = horses.user_id
      and cml.status = 'accepted'
  )
);

-- =========================
-- Allow club_head to SELECT horses for linked riders
-- =========================
drop policy if exists "horses_select_linked_club_head" on public.horses;
create policy "horses_select_linked_club_head"
on public.horses
for select
to authenticated
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.club_member_links cml
    where cml.club_head_id = auth.uid()
      and cml.rider_id = horses.user_id
      and cml.status = 'accepted'
  )
);

-- =========================
-- Allow club_member to SELECT their own horses
-- (already covered by standard user policy, but explicit for safety)
-- =========================
drop policy if exists "horses_select_club_member_own" on public.horses;
create policy "horses_select_club_member_own"
on public.horses
for select
to authenticated
using (
  auth.uid() = user_id
);

-- =========================
-- Allow club_head to INSERT horse_rider_combos for linked riders
-- =========================
drop policy if exists "combos_insert_club_head" on public.horse_rider_combos;
create policy "combos_insert_club_head"
on public.horse_rider_combos
for insert
to authenticated
with check (
  auth.uid() = user_id
  or exists (
    select 1
    from public.club_member_links cml
    where cml.club_head_id = auth.uid()
      and cml.rider_id = horse_rider_combos.user_id
      and cml.status = 'accepted'
  )
);

-- =========================
-- Allow club_head to UPDATE horse_rider_combos for linked riders
-- =========================
drop policy if exists "combos_update_club_head" on public.horse_rider_combos;
create policy "combos_update_club_head"
on public.horse_rider_combos
for update
to authenticated
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.club_member_links cml
    where cml.club_head_id = auth.uid()
      and cml.rider_id = horse_rider_combos.user_id
      and cml.status = 'accepted'
  )
)
with check (
  auth.uid() = user_id
  or exists (
    select 1
    from public.club_member_links cml
    where cml.club_head_id = auth.uid()
      and cml.rider_id = horse_rider_combos.user_id
      and cml.status = 'accepted'
  )
);

-- =========================
-- Allow club_head to SELECT combos for linked riders
-- =========================
drop policy if exists "combos_select_linked_club_head" on public.horse_rider_combos;
create policy "combos_select_linked_club_head"
on public.horse_rider_combos
for select
to authenticated
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.club_member_links cml
    where cml.club_head_id = auth.uid()
      and cml.rider_id = horse_rider_combos.user_id
      and cml.status = 'accepted'
  )
);

-- =========================
-- Allow club_member to SELECT their own combos
-- =========================
drop policy if exists "combos_select_club_member_own" on public.horse_rider_combos;
create policy "combos_select_club_member_own"
on public.horse_rider_combos
for select
to authenticated
using (
  auth.uid() = user_id
);

-- =========================
-- Allow club_head to INSERT personal_bests for linked riders' combos
-- =========================
drop policy if exists "personal_bests_insert_club_head" on public.personal_bests;
create policy "personal_bests_insert_club_head"
on public.personal_bests
for insert
to authenticated
with check (
  exists (
    select 1
    from public.horse_rider_combos hrc
    where hrc.id = personal_bests.combo_id
      and (
        auth.uid() = hrc.user_id
        or exists (
          select 1
          from public.club_member_links cml
          where cml.club_head_id = auth.uid()
            and cml.rider_id = hrc.user_id
            and cml.status = 'accepted'
        )
      )
  )
);

-- =========================
-- Allow club_head to UPDATE personal_bests for linked riders' combos
-- =========================
drop policy if exists "personal_bests_update_club_head" on public.personal_bests;
create policy "personal_bests_update_club_head"
on public.personal_bests
for update
to authenticated
using (
  exists (
    select 1
    from public.horse_rider_combos hrc
    where hrc.id = personal_bests.combo_id
      and (
        auth.uid() = hrc.user_id
        or exists (
          select 1
          from public.club_member_links cml
          where cml.club_head_id = auth.uid()
            and cml.rider_id = hrc.user_id
            and cml.status = 'accepted'
        )
      )
  )
);

-- =========================
-- Allow club_member to SELECT their own personal_bests
-- =========================
drop policy if exists "personal_bests_select_club_member_own" on public.personal_bests;
create policy "personal_bests_select_club_member_own"
on public.personal_bests
for select
to authenticated
using (
  exists (
    select 1
    from public.horse_rider_combos hrc
    where hrc.id = personal_bests.combo_id
      and auth.uid() = hrc.user_id
  )
);

-- =========================
-- Allow club_head to SELECT personal_bests for linked riders
-- =========================
drop policy if exists "personal_bests_select_club_head" on public.personal_bests;
create policy "personal_bests_select_club_head"
on public.personal_bests
for select
to authenticated
using (
  exists (
    select 1
    from public.horse_rider_combos hrc
    where hrc.id = personal_bests.combo_id
      and (
        auth.uid() = hrc.user_id
        or exists (
          select 1
          from public.club_member_links cml
          where cml.club_head_id = auth.uid()
            and cml.rider_id = hrc.user_id
            and cml.status = 'accepted'
        )
      )
  )
);

-- =========================
-- Allow club_head to INSERT qualifier_results for linked riders
-- =========================
drop policy if exists "qualifier_results_insert_club_head" on public.qualifier_results;
create policy "qualifier_results_insert_club_head"
on public.qualifier_results
for insert
to authenticated
with check (
  exists (
    select 1
    from public.horse_rider_combos hrc
    where hrc.id = qualifier_results.combo_id
      and (
        auth.uid() = hrc.user_id
        or exists (
          select 1
          from public.club_member_links cml
          where cml.club_head_id = auth.uid()
            and cml.rider_id = hrc.user_id
            and cml.status = 'accepted'
        )
      )
  )
);

-- =========================
-- Allow club_head to UPDATE qualifier_results for linked riders
-- =========================
drop policy if exists "qualifier_results_update_club_head" on public.qualifier_results;
create policy "qualifier_results_update_club_head"
on public.qualifier_results
for update
to authenticated
using (
  exists (
    select 1
    from public.horse_rider_combos hrc
    where hrc.id = qualifier_results.combo_id
      and (
        auth.uid() = hrc.user_id
        or exists (
          select 1
          from public.club_member_links cml
          where cml.club_head_id = auth.uid()
            and cml.rider_id = hrc.user_id
            and cml.status = 'accepted'
        )
      )
  )
);

-- =========================
-- Allow club_head to DELETE qualifier_results for linked riders
-- =========================
drop policy if exists "qualifier_results_delete_club_head" on public.qualifier_results;
create policy "qualifier_results_delete_club_head"
on public.qualifier_results
for delete
to authenticated
using (
  exists (
    select 1
    from public.horse_rider_combos hrc
    where hrc.id = qualifier_results.combo_id
      and (
        auth.uid() = hrc.user_id
        or exists (
          select 1
          from public.club_member_links cml
          where cml.club_head_id = auth.uid()
            and cml.rider_id = hrc.user_id
            and cml.status = 'accepted'
        )
      )
  )
);

-- =========================
-- Allow club_member to SELECT their own qualifier_results
-- =========================
drop policy if exists "qualifier_results_select_club_member_own" on public.qualifier_results;
create policy "qualifier_results_select_club_member_own"
on public.qualifier_results
for select
to authenticated
using (
  exists (
    select 1
    from public.horse_rider_combos hrc
    where hrc.id = qualifier_results.combo_id
      and auth.uid() = hrc.user_id
  )
);

-- =========================
-- Allow club_head to SELECT qualifier_results for linked riders
-- =========================
drop policy if exists "qualifier_results_select_club_head" on public.qualifier_results;
create policy "qualifier_results_select_club_head"
on public.qualifier_results
for select
to authenticated
using (
  exists (
    select 1
    from public.horse_rider_combos hrc
    where hrc.id = qualifier_results.combo_id
      and (
        auth.uid() = hrc.user_id
        or exists (
          select 1
          from public.club_member_links cml
          where cml.club_head_id = auth.uid()
            and cml.rider_id = hrc.user_id
            and cml.status = 'accepted'
        )
      )
  )
);

-- =========================
-- Allow notifications for club link requests / responses
-- =========================
drop policy if exists "notifications_insert_for_club_member" on public.notifications;
create policy "notifications_insert_for_club_member"
on public.notifications
for insert
to authenticated
with check (
  -- Club head can notify a rider they sent a link request to
  exists (
    select 1
    from public.club_member_links cml
    where cml.club_head_id = auth.uid()
      and cml.rider_id = notifications.user_id
  )
  -- Rider can notify club head (accept/reject response)
  or exists (
    select 1
    from public.club_member_links cml
    where cml.rider_id = auth.uid()
      and cml.club_head_id = notifications.user_id
  )
);
