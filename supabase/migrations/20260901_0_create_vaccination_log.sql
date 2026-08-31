-- vaccination_log was defined in supabase/horses_schema.sql (one of the
-- "run manually" reference files) but was apparently never actually created
-- in production — discovered when 20260901_admin_dossier_rls_gaps_2.sql
-- failed with "relation vaccination_log does not exist". This also means
-- the app's real vaccination-logging writes (HorseDetails.jsx) have likely
-- been silently failing until now. Run this before re-running that gaps
-- migration.

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'vaccination_type'
      and n.nspname = 'public'
  ) then
    create type public.vaccination_type as enum ('flu', 'ahs');
  end if;
end
$$;

create table if not exists public.vaccination_log (
  id uuid primary key default gen_random_uuid(),
  horse_id uuid not null references public.horses (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  vaccination_type public.vaccination_type not null,
  dose_number integer,
  date_administered date not null,
  vet_name text not null,
  notes text,
  created_at timestamptz not null default now(),
  constraint vaccination_log_dose_number_check check (dose_number is null or dose_number between 1 and 3)
);

create index if not exists vaccination_log_horse_date_idx on public.vaccination_log (horse_id, date_administered desc);
create index if not exists vaccination_log_user_date_idx on public.vaccination_log (user_id, date_administered desc);

alter table public.vaccination_log enable row level security;

drop policy if exists "vaccination_log_select_own" on public.vaccination_log;
create policy "vaccination_log_select_own"
on public.vaccination_log for select
using (auth.uid() = user_id);

drop policy if exists "vaccination_log_insert_own" on public.vaccination_log;
create policy "vaccination_log_insert_own"
on public.vaccination_log for insert
with check (auth.uid() = user_id);

drop policy if exists "vaccination_log_update_own" on public.vaccination_log;
create policy "vaccination_log_update_own"
on public.vaccination_log for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "vaccination_log_delete_own" on public.vaccination_log;
create policy "vaccination_log_delete_own"
on public.vaccination_log for delete
using (auth.uid() = user_id);
