-- =====================================================================
-- qualifier_events Row-Level Security
-- ---------------------------------------------------------------------
-- Symptom this fixes:
--   Editing a qualifier event in the Admin Events page appears to save
--   successfully (the toast says "Event updated successfully"), but the
--   change (e.g. qualifier_number) is not actually persisted and other
--   pages still show the old value.
--
-- Cause:
--   `qualifier_events` has RLS enabled but no UPDATE / INSERT / DELETE
--   policy that allows authenticated admins to write. PostgREST /
--   Supabase silently returns no error and no affected rows in that
--   case, so the client thinks the write succeeded.
--
-- Fix:
--   Define explicit policies so:
--     - Any authenticated user can READ events (already needed by the
--       Qualifier Tracker and other pages)
--     - Users whose profile.role = 'admin' can INSERT / UPDATE / DELETE
--
-- Run this in the Supabase SQL editor.
-- =====================================================================

alter table public.qualifier_events enable row level security;

-- ---------------------------------------------------------------------
-- SELECT: any authenticated user can read events
-- ---------------------------------------------------------------------
drop policy if exists "qualifier_events_select_authenticated" on public.qualifier_events;
create policy "qualifier_events_select_authenticated"
on public.qualifier_events
for select
to authenticated
using (true);

-- ---------------------------------------------------------------------
-- INSERT: admin only
-- ---------------------------------------------------------------------
drop policy if exists "qualifier_events_insert_admin" on public.qualifier_events;
create policy "qualifier_events_insert_admin"
on public.qualifier_events
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

-- ---------------------------------------------------------------------
-- UPDATE: admin only
-- (Both USING and WITH CHECK need to be true for the update to be
--  visible AND for the new row to be accepted.)
-- ---------------------------------------------------------------------
drop policy if exists "qualifier_events_update_admin" on public.qualifier_events;
create policy "qualifier_events_update_admin"
on public.qualifier_events
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

-- ---------------------------------------------------------------------
-- DELETE: admin only
-- ---------------------------------------------------------------------
drop policy if exists "qualifier_events_delete_admin" on public.qualifier_events;
create policy "qualifier_events_delete_admin"
on public.qualifier_events
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

-- ---------------------------------------------------------------------
-- Sanity check (optional): list the policies on the table
-- ---------------------------------------------------------------------
-- select policyname, cmd, qual, with_check
-- from pg_policies
-- where schemaname = 'public'
--   and tablename = 'qualifier_events'
-- order by cmd, policyname;
