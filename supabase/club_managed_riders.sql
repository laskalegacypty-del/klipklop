-- Head-managed club/family members (no auth account).
-- Horses live on the club_head profile; members link via horse_rider_combos.managed_rider_id.

-- =========================
-- club_managed_riders
-- =========================
create table if not exists public.club_managed_riders (
  id                uuid        primary key default gen_random_uuid(),
  club_head_id      uuid        not null references public.profiles (id) on delete cascade,
  rider_name        text        not null,
  age_category      text,
  province          text,
  profile_photo_url text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists cmr_club_head_idx on public.club_managed_riders (club_head_id);

alter table public.club_managed_riders enable row level security;

drop policy if exists "cmr_select_club_head" on public.club_managed_riders;
create policy "cmr_select_club_head"
on public.club_managed_riders
for select
to authenticated
using (auth.uid() = club_head_id);

drop policy if exists "cmr_insert_club_head" on public.club_managed_riders;
create policy "cmr_insert_club_head"
on public.club_managed_riders
for insert
to authenticated
with check (auth.uid() = club_head_id);

drop policy if exists "cmr_update_club_head" on public.club_managed_riders;
create policy "cmr_update_club_head"
on public.club_managed_riders
for update
to authenticated
using (auth.uid() = club_head_id)
with check (auth.uid() = club_head_id);

drop policy if exists "cmr_delete_club_head" on public.club_managed_riders;
create policy "cmr_delete_club_head"
on public.club_managed_riders
for delete
to authenticated
using (auth.uid() = club_head_id);

-- =========================
-- horse_rider_combos.managed_rider_id
-- =========================
alter table public.horse_rider_combos
  add column if not exists managed_rider_id uuid references public.club_managed_riders (id) on delete cascade;

create index if not exists horse_rider_combos_managed_rider_id_idx
  on public.horse_rider_combos (managed_rider_id);

-- Managed combos: user_id = club head, managed_rider_id set, horse from head's stable
drop policy if exists "combos_insert_managed_club_head" on public.horse_rider_combos;
create policy "combos_insert_managed_club_head"
on public.horse_rider_combos
for insert
to authenticated
with check (
  auth.uid() = user_id
  and managed_rider_id is not null
  and exists (
    select 1 from public.club_managed_riders cmr
    where cmr.id = horse_rider_combos.managed_rider_id
      and cmr.club_head_id = auth.uid()
  )
  and (
    horse_id is null
    or exists (
      select 1 from public.horses h
      where h.id = horse_rider_combos.horse_id
        and h.user_id = auth.uid()
    )
  )
);

drop policy if exists "combos_update_managed_club_head" on public.horse_rider_combos;
create policy "combos_update_managed_club_head"
on public.horse_rider_combos
for update
to authenticated
using (
  auth.uid() = user_id
  and managed_rider_id is not null
  and exists (
    select 1 from public.club_managed_riders cmr
    where cmr.id = horse_rider_combos.managed_rider_id
      and cmr.club_head_id = auth.uid()
  )
)
with check (
  auth.uid() = user_id
  and managed_rider_id is not null
  and exists (
    select 1 from public.club_managed_riders cmr
    where cmr.id = horse_rider_combos.managed_rider_id
      and cmr.club_head_id = auth.uid()
  )
  and (
    horse_id is null
    or exists (
      select 1 from public.horses h
      where h.id = horse_rider_combos.horse_id
        and h.user_id = auth.uid()
    )
  )
);

drop policy if exists "combos_delete_managed_club_head" on public.horse_rider_combos;
create policy "combos_delete_managed_club_head"
on public.horse_rider_combos
for delete
to authenticated
using (
  auth.uid() = user_id
  and managed_rider_id is not null
  and exists (
    select 1 from public.club_managed_riders cmr
    where cmr.id = horse_rider_combos.managed_rider_id
      and cmr.club_head_id = auth.uid()
  )
);
