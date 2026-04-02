-- Supporter-Rider link table + RLS policies (run in Supabase SQL editor)
-- Goal:
--   - Supporters can request to follow a rider
--   - Riders can accept or reject requests
--   - Accepted supporters can read the rider's horses, combos, times, and results
--
-- Assumptions:
--   - `profiles.id` matches `auth.uid()`
--   - `profiles.role` is 'supporter' for supporters and 'user' for riders

-- =========================
-- supporter_rider_links
-- =========================
create table if not exists public.supporter_rider_links (
  id uuid primary key default gen_random_uuid(),
  supporter_id uuid not null references public.profiles (id) on delete cascade,
  rider_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending', -- 'pending' | 'accepted' | 'rejected'
  created_at timestamptz not null default now(),
  constraint unique_supporter_rider unique (supporter_id, rider_id)
);

create index if not exists srl_supporter_id_idx on public.supporter_rider_links (supporter_id);
create index if not exists srl_rider_id_idx on public.supporter_rider_links (rider_id);
create index if not exists srl_status_idx on public.supporter_rider_links (status);

alter table public.supporter_rider_links enable row level security;

-- Supporter or rider can read links they are part of
drop policy if exists "srl_select_participant" on public.supporter_rider_links;
create policy "srl_select_participant"
on public.supporter_rider_links
for select
to authenticated
using (
  auth.uid() = supporter_id
  or auth.uid() = rider_id
);

-- Supporter can send a request (insert own rows)
drop policy if exists "srl_insert_supporter" on public.supporter_rider_links;
create policy "srl_insert_supporter"
on public.supporter_rider_links
for insert
to authenticated
with check (auth.uid() = supporter_id);

-- Rider can accept or reject (update status on rows where they are the rider)
drop policy if exists "srl_update_rider" on public.supporter_rider_links;
create policy "srl_update_rider"
on public.supporter_rider_links
for update
to authenticated
using (auth.uid() = rider_id)
with check (auth.uid() = rider_id);

-- Supporter can withdraw a pending request (delete own rows)
drop policy if exists "srl_delete_supporter" on public.supporter_rider_links;
create policy "srl_delete_supporter"
on public.supporter_rider_links
for delete
to authenticated
using (auth.uid() = supporter_id);

-- =========================
-- Allow supporters to read linked riders' profiles
-- (needed for searching and displaying rider info)
-- =========================
-- Note: profiles likely already has a broad select policy.
-- If not, add this policy so supporters can look up rider profiles:

drop policy if exists "profiles_select_own_or_linked" on public.profiles;
create policy "profiles_select_own_or_linked"
on public.profiles
for select
to authenticated
using (
  -- own profile
  auth.uid() = id
  -- or any authenticated user can read basic profile info (needed for supporter search)
  or true
);

-- =========================
-- Allow linked supporters to read horses
-- =========================
drop policy if exists "horses_select_linked_supporter" on public.horses;
create policy "horses_select_linked_supporter"
on public.horses
for select
to authenticated
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.supporter_rider_links srl
    where srl.supporter_id = auth.uid()
      and srl.rider_id = horses.user_id
      and srl.status = 'accepted'
  )
);

-- =========================
-- Allow linked supporters to read horse_rider_combos
-- =========================
drop policy if exists "combos_select_linked_supporter" on public.horse_rider_combos;
create policy "combos_select_linked_supporter"
on public.horse_rider_combos
for select
to authenticated
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.supporter_rider_links srl
    where srl.supporter_id = auth.uid()
      and srl.rider_id = horse_rider_combos.user_id
      and srl.status = 'accepted'
  )
);

-- =========================
-- Allow linked supporters to read personal_bests
-- personal_bests references combo_id; we join via horse_rider_combos to get user_id
-- =========================
drop policy if exists "personal_bests_select_linked_supporter" on public.personal_bests;
create policy "personal_bests_select_linked_supporter"
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
          from public.supporter_rider_links srl
          where srl.supporter_id = auth.uid()
            and srl.rider_id = hrc.user_id
            and srl.status = 'accepted'
        )
      )
  )
);

-- =========================
-- Allow linked supporters to read qualifier_results
-- qualifier_results references combo_id; same join pattern
-- =========================
drop policy if exists "qualifier_results_select_linked_supporter" on public.qualifier_results;
create policy "qualifier_results_select_linked_supporter"
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
          from public.supporter_rider_links srl
          where srl.supporter_id = auth.uid()
            and srl.rider_id = hrc.user_id
            and srl.status = 'accepted'
        )
      )
  )
);

-- =========================
-- Allow app to insert notifications for riders (supporter request notification)
-- The existing notifications_insert_own policy only allows users to notify themselves.
-- We need supporters to insert a notification row for the rider they are requesting.
-- =========================
drop policy if exists "notifications_insert_for_linked_rider" on public.notifications;
create policy "notifications_insert_for_linked_rider"
on public.notifications
for insert
to authenticated
with check (
  -- Supporter can notify a rider they just sent a request to
  exists (
    select 1
    from public.supporter_rider_links srl
    where srl.supporter_id = auth.uid()
      and srl.rider_id = notifications.user_id
  )
  -- Rider can notify a supporter (accept/reject response)
  or exists (
    select 1
    from public.supporter_rider_links srl
    where srl.rider_id = auth.uid()
      and srl.supporter_id = notifications.user_id
  )
);
