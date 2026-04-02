-- Announcements RLS policies (run in Supabase SQL editor)
-- Goal:
--  - Anyone logged in can READ announcements (needed for user dashboard)
--  - Only admins can INSERT / UPDATE / DELETE announcements
--
-- Assumptions:
--  - `profiles.id` matches `auth.uid()`
--  - `profiles.role` is 'admin' for admins

alter table public.announcements enable row level security;

-- Read: any authenticated user
drop policy if exists "announcements_select_authenticated" on public.announcements;
create policy "announcements_select_authenticated"
on public.announcements
for select
to authenticated
using (true);

-- Helper predicate: current user is admin
-- (kept inline in each policy to avoid function permission complexity)

-- Write: admin only
drop policy if exists "announcements_insert_admin" on public.announcements;
create policy "announcements_insert_admin"
on public.announcements
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

drop policy if exists "announcements_update_admin" on public.announcements;
create policy "announcements_update_admin"
on public.announcements
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

drop policy if exists "announcements_delete_admin" on public.announcements;
create policy "announcements_delete_admin"
on public.announcements
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

