-- Allow age_category and scoresheet_name to be NULL
-- Required for the Supporter role, which has no age category or scoresheet name.
-- Run this in the Supabase SQL editor.

alter table public.profiles
  alter column age_category drop not null;

alter table public.profiles
  alter column scoresheet_name drop not null;
