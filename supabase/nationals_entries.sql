-- =====================================================================
-- nationals_entries
-- ---------------------------------------------------------------------
-- Published SAWMGA Nationals running order / timeslots, used by the
-- public, no-login /nationals page so a rider can look themselves up by
-- name and see their own program. This is published event-program
-- information (same sensitivity as a printed running order handed out
-- at the show), so it is readable by anyone (anon), but only writable
-- by the service role (seeded/updated out-of-band, not through the app).
-- =====================================================================

create table if not exists public.nationals_entries (
  id                uuid primary key default gen_random_uuid(),
  day               date,
  session_label     text,       -- e.g. "Silver Nationals - Day 1"
  scheduled_time    text,       -- kept as text: source data may be exact times or approximate session slots
  arena             text,       -- e.g. "Arena 1A", "Arena 9B"
  run_number        integer,
  game              text,       -- WMG game/event name (Poles I, Barrel Race, etc.)
  level             text,       -- the entered/seeded level the rider is running at, if known ahead of time
  rider_name        text not null,
  horse_name        text,
  club              text,
  province          text,
  created_at        timestamptz not null default now()
);

create index if not exists nationals_entries_rider_name_idx
  on public.nationals_entries (lower(rider_name));

alter table public.nationals_entries enable row level security;

drop policy if exists "nationals_entries_select_public" on public.nationals_entries;
create policy "nationals_entries_select_public"
on public.nationals_entries
for select
to anon, authenticated
using (true);

-- No insert/update/delete policy for anon/authenticated — rows are
-- seeded/updated only via the service role key (bypasses RLS), so
-- there is deliberately no write policy here.
