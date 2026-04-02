-- Notifications RLS policies for admin-broadcast inserts (run in Supabase SQL editor)
-- Goal:
--  - Normal users can CRUD their own notifications
--  - Admins can INSERT notifications for any user (broadcast announcements)
--
-- Assumptions:
--  - `profiles.id` matches `auth.uid()`
--  - `profiles.role` is 'admin' for admins

alter table public.notifications enable row level security;

-- Read own notifications (users + admins)
drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
on public.notifications
for select
to authenticated
using (auth.uid() = user_id);

-- Insert own notifications (allows app features that notify the current user)
drop policy if exists "notifications_insert_own" on public.notifications;
create policy "notifications_insert_own"
on public.notifications
for insert
to authenticated
with check (auth.uid() = user_id);

-- Admin can insert notifications for anyone (broadcast)
drop policy if exists "notifications_insert_admin_any" on public.notifications;
create policy "notifications_insert_admin_any"
on public.notifications
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

-- Update own notifications (mark read, etc.)
drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own"
on public.notifications
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Delete own notifications
drop policy if exists "notifications_delete_own" on public.notifications;
create policy "notifications_delete_own"
on public.notifications
for delete
to authenticated
using (auth.uid() = user_id);

