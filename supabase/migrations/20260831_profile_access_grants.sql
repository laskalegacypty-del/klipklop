-- Time-limited, consent-based admin access to a rider/user's profile dossier.
-- Courtesy/audit layer: this table tracks the request/consent/expiry lifecycle
-- and drives the UX. It does NOT restrict admins' existing DB-level access to
-- profiles/horses/results/etc (admins already read those via role='admin' RLS,
-- see 20260831_admin_dossier_rls_gaps.sql). The dossier page itself gates on
-- an active grant client-side.

create table if not exists public.profile_access_grants (
  id               uuid        primary key default gen_random_uuid(),
  admin_id         uuid        not null references public.profiles (id) on delete cascade,
  user_id          uuid        not null references public.profiles (id) on delete cascade,
  status           text        not null default 'pending'
                     check (status in ('pending', 'accepted', 'declined', 'revoked')),
  duration_preset  text        not null check (duration_preset in ('24h', '1w', 'custom')),
  requested_hours  integer     not null check (requested_hours between 1 and 720), -- max 30 days
  reason           text,
  created_at       timestamptz not null default now(),
  responded_at     timestamptz,
  expires_at       timestamptz,
  revoked_at       timestamptz,
  revoked_by       uuid        references public.profiles (id)
);

-- Guard against duplicate pending requests from the same admin to the same user
create unique index if not exists pag_unique_pending
  on public.profile_access_grants (admin_id, user_id)
  where status = 'pending';

create index if not exists pag_admin_idx  on public.profile_access_grants (admin_id);
create index if not exists pag_user_idx   on public.profile_access_grants (user_id);
create index if not exists pag_status_idx on public.profile_access_grants (status);

alter table public.profile_access_grants enable row level security;

-- Admin (requester) or user (target) can read grants they're part of
drop policy if exists "pag_select_participant" on public.profile_access_grants;
create policy "pag_select_participant"
on public.profile_access_grants
for select
to authenticated
using (auth.uid() = admin_id or auth.uid() = user_id);

-- Only an admin can create a request, only as themselves
drop policy if exists "pag_insert_admin" on public.profile_access_grants;
create policy "pag_insert_admin"
on public.profile_access_grants
for insert
to authenticated
with check (
  auth.uid() = admin_id
  and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- Target user can accept / decline / revoke (any update to their own row)
drop policy if exists "pag_update_user" on public.profile_access_grants;
create policy "pag_update_user"
on public.profile_access_grants
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Admin can cancel their own still-pending request
drop policy if exists "pag_delete_admin_pending" on public.profile_access_grants;
create policy "pag_delete_admin_pending"
on public.profile_access_grants
for delete
to authenticated
using (auth.uid() = admin_id and status = 'pending');

-- Notifications: admin can notify the user they requested access from;
-- user can notify the admin back on accept/decline/revoke.
drop policy if exists "notifications_insert_for_profile_access" on public.notifications;
create policy "notifications_insert_for_profile_access"
on public.notifications
for insert
to authenticated
with check (
  exists (
    select 1 from public.profile_access_grants pag
    where pag.admin_id = auth.uid() and pag.user_id = notifications.user_id
  )
  or exists (
    select 1 from public.profile_access_grants pag
    where pag.user_id = auth.uid() and pag.admin_id = notifications.user_id
  )
);
