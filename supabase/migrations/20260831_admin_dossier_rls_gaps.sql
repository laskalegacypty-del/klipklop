-- Admin-role SELECT gaps needed for the profile dossier page to load.
-- General role-based access (not grant-scoped) per the profile_access_grants
-- courtesy-layer design: admins already read profiles freely, but had no read
-- access to these related tables. profiles, qualifier_events and
-- problem_reports already have admin-read policies, so are not touched here.

drop policy if exists "horses_select_admin" on public.horses;
create policy "horses_select_admin" on public.horses for select to authenticated
using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "combos_select_admin" on public.horse_rider_combos;
create policy "combos_select_admin" on public.horse_rider_combos for select to authenticated
using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "personal_bests_select_admin" on public.personal_bests;
create policy "personal_bests_select_admin" on public.personal_bests for select to authenticated
using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "qualifier_results_select_admin" on public.qualifier_results;
create policy "qualifier_results_select_admin" on public.qualifier_results for select to authenticated
using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "event_day_results_select_admin" on public.event_day_results;
create policy "event_day_results_select_admin" on public.event_day_results for select to authenticated
using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "cml_select_admin" on public.club_member_links;
create policy "cml_select_admin" on public.club_member_links for select to authenticated
using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "srl_select_admin" on public.supporter_rider_links;
create policy "srl_select_admin" on public.supporter_rider_links for select to authenticated
using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "notifications_select_admin" on public.notifications;
create policy "notifications_select_admin" on public.notifications for select to authenticated
using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
