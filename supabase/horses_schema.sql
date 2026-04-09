-- Horses + Health Tracking schema (run in Supabase SQL editor)
-- Creates:
--   - horses
--   - horse_medical_entries
--   - horse_reminders
-- And enables RLS policies so users only access their own rows.

-- Extensions (Supabase usually has pgcrypto enabled, but this is safe)
create extension if not exists pgcrypto;

-- Updated-at helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================
-- horses
-- =========================
create table if not exists public.horses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  breed text,
  sex text not null default 'unknown',
  dob date,
  birth_year int,
  color text,
  microchip_or_passport text,
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists horses_user_id_idx on public.horses (user_id);
create index if not exists horses_user_id_name_idx on public.horses (user_id, name);

drop trigger if exists set_horses_updated_at on public.horses;
create trigger set_horses_updated_at
before update on public.horses
for each row execute procedure public.set_updated_at();

alter table public.horses enable row level security;

drop policy if exists "horses_select_own" on public.horses;
create policy "horses_select_own"
on public.horses for select
using (auth.uid() = user_id);

drop policy if exists "horses_insert_own" on public.horses;
create policy "horses_insert_own"
on public.horses for insert
with check (auth.uid() = user_id);

drop policy if exists "horses_update_own" on public.horses;
create policy "horses_update_own"
on public.horses for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "horses_delete_own" on public.horses;
create policy "horses_delete_own"
on public.horses for delete
using (auth.uid() = user_id);

-- =========================
-- horse_medical_entries
-- =========================
create table if not exists public.horse_medical_entries (
  id uuid primary key default gen_random_uuid(),
  horse_id uuid not null references public.horses (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null default 'other',
  title text not null,
  date date not null,
  notes text,
  vital_type text,
  vital_value numeric(8,2),
  vital_text_value text,
  recorded_at timestamptz,
  is_abnormal boolean not null default false,
  abnormal_reason text,
  created_at timestamptz not null default now()
);

alter table public.horse_medical_entries
  add column if not exists vital_type text,
  add column if not exists vital_value numeric(8,2),
  add column if not exists vital_text_value text,
  add column if not exists recorded_at timestamptz,
  add column if not exists is_abnormal boolean not null default false,
  add column if not exists abnormal_reason text;

create index if not exists horse_medical_entries_horse_id_idx on public.horse_medical_entries (horse_id);
create index if not exists horse_medical_entries_user_id_idx on public.horse_medical_entries (user_id);
create index if not exists horse_medical_entries_horse_date_idx on public.horse_medical_entries (horse_id, date desc);

alter table public.horse_medical_entries enable row level security;

drop policy if exists "horse_medical_entries_select_own" on public.horse_medical_entries;
create policy "horse_medical_entries_select_own"
on public.horse_medical_entries for select
using (auth.uid() = user_id);

drop policy if exists "horse_medical_entries_insert_own" on public.horse_medical_entries;
create policy "horse_medical_entries_insert_own"
on public.horse_medical_entries for insert
with check (auth.uid() = user_id);

drop policy if exists "horse_medical_entries_update_own" on public.horse_medical_entries;
create policy "horse_medical_entries_update_own"
on public.horse_medical_entries for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "horse_medical_entries_delete_own" on public.horse_medical_entries;
create policy "horse_medical_entries_delete_own"
on public.horse_medical_entries for delete
using (auth.uid() = user_id);

-- =========================
-- horse_reminders
-- =========================
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'horse_reminder_type'
      and n.nspname = 'public'
  ) then
    create type public.horse_reminder_type as enum (
      'flu_vaccination',
      'ahs_vaccination',
      'farrier',
      'deworming',
      'dental',
      'coggins_test',
      'passport_renewal',
      'custom'
    );
  end if;
end
$$;

create table if not exists public.horse_reminders (
  id uuid primary key default gen_random_uuid(),
  horse_id uuid not null references public.horses (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  label text not null,
  due_date date not null,
  is_done boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.horse_reminders
  add column if not exists reminder_type public.horse_reminder_type default 'custom',
  add column if not exists last_done_date date,
  add column if not exists next_due_date date,
  add column if not exists vet_name text,
  add column if not exists notes text,
  add column if not exists is_primary_course_complete boolean not null default false,
  add column if not exists notification_days_before int[] not null default array[30, 14, 7, 1],
  add column if not exists custom_label text,
  add column if not exists interval_value integer,
  add column if not exists interval_unit text,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

update public.horse_reminders
set
  reminder_type = coalesce(reminder_type, 'custom'::public.horse_reminder_type),
  custom_label = coalesce(custom_label, label),
  last_done_date = coalesce(last_done_date, created_at::date),
  next_due_date = coalesce(next_due_date, due_date),
  notification_days_before = coalesce(notification_days_before, array[30, 14, 7, 1]),
  updated_at = coalesce(updated_at, created_at)
where
  reminder_type is null
  or custom_label is null
  or next_due_date is null
  or notification_days_before is null;

alter table public.horse_reminders
  alter column reminder_type set not null,
  alter column next_due_date set not null;

create index if not exists horse_reminders_horse_id_idx on public.horse_reminders (horse_id);
create index if not exists horse_reminders_user_id_idx on public.horse_reminders (user_id);
create index if not exists horse_reminders_user_due_idx on public.horse_reminders (user_id, is_done, due_date);
create index if not exists horse_reminders_user_horse_next_due_idx on public.horse_reminders (user_id, horse_id, next_due_date);
create index if not exists horse_reminders_user_next_due_idx on public.horse_reminders (user_id, next_due_date);

drop trigger if exists set_horse_reminders_updated_at on public.horse_reminders;
create trigger set_horse_reminders_updated_at
before update on public.horse_reminders
for each row execute procedure public.set_updated_at();

alter table public.horse_reminders enable row level security;

drop policy if exists "horse_reminders_select_own" on public.horse_reminders;
create policy "horse_reminders_select_own"
on public.horse_reminders for select
using (auth.uid() = user_id);

drop policy if exists "horse_reminders_insert_own" on public.horse_reminders;
create policy "horse_reminders_insert_own"
on public.horse_reminders for insert
with check (auth.uid() = user_id);

drop policy if exists "horse_reminders_update_own" on public.horse_reminders;
create policy "horse_reminders_update_own"
on public.horse_reminders for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "horse_reminders_delete_own" on public.horse_reminders;
create policy "horse_reminders_delete_own"
on public.horse_reminders for delete
using (auth.uid() = user_id);

-- =========================
-- vaccination_log
-- =========================
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

-- =========================
-- Reminder notifications scheduler helpers
-- =========================
create unique index if not exists notifications_horse_reminder_unique_idx
on public.notifications (user_id, type, link, message)
where type = 'horse_reminder_due';

create or replace function public.enqueue_horse_reminder_notifications(p_target_date date default current_date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer := 0;
begin
  insert into public.notifications (user_id, type, message, link, is_read)
  select
    r.user_id,
    'horse_reminder_due',
    format(
      '%s reminder for %s is due on %s (%s day%s left).',
      coalesce(nullif(r.custom_label, ''), nullif(r.label, ''), replace(r.reminder_type::text, '_', ' ')),
      h.name,
      to_char(r.next_due_date, 'DD Mon YYYY'),
      greatest((r.next_due_date - p_target_date), 0),
      case when (r.next_due_date - p_target_date) = 1 then '' else 's' end
    ),
    format('/horses/%s?tab=reminders', r.horse_id),
    false
  from public.horse_reminders r
  join public.horses h on h.id = r.horse_id
  where
    coalesce(r.is_done, false) = false
    and r.next_due_date is not null
    and (r.next_due_date - p_target_date) = any(coalesce(r.notification_days_before, array[30, 14, 7, 1]))
  on conflict do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

