alter table if exists public.profiles
  add column if not exists has_seen_tutorial boolean not null default false;

update public.profiles
set has_seen_tutorial = false
where has_seen_tutorial is null;
