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
  created_at timestamptz not null default now()
);

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
create table if not exists public.horse_reminders (
  id uuid primary key default gen_random_uuid(),
  horse_id uuid not null references public.horses (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  label text not null,
  due_date date not null,
  is_done boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists horse_reminders_horse_id_idx on public.horse_reminders (horse_id);
create index if not exists horse_reminders_user_id_idx on public.horse_reminders (user_id);
create index if not exists horse_reminders_user_due_idx on public.horse_reminders (user_id, is_done, due_date);

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

