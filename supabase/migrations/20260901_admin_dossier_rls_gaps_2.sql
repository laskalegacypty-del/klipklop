-- Admin-role SELECT gaps for the "View As Rider" feature — needed so
-- HorseDetails.jsx (reminders/medical/vaccination tabs) loads real data when
-- an admin is browsing under an active view-as session. Same role-based idiom
-- as the first dossier RLS gap-fill.

drop policy if exists "horse_reminders_select_admin" on public.horse_reminders;
create policy "horse_reminders_select_admin" on public.horse_reminders for select to authenticated
using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "horse_medical_entries_select_admin" on public.horse_medical_entries;
create policy "horse_medical_entries_select_admin" on public.horse_medical_entries for select to authenticated
using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "vaccination_log_select_admin" on public.vaccination_log;
create policy "vaccination_log_select_admin" on public.vaccination_log for select to authenticated
using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
