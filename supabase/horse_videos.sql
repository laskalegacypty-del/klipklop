-- Horse and qualifier videos (run in Supabase SQL editor)
create extension if not exists pgcrypto;

create table if not exists public.horse_videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  horse_id uuid references public.horses (id) on delete cascade,
  qualifier_id uuid references public.qualifier_events (id) on delete set null,
  video_url text not null,
  title text not null,
  created_at timestamptz not null default now()
);

create index if not exists horse_videos_user_id_idx on public.horse_videos (user_id);
create index if not exists horse_videos_horse_id_idx on public.horse_videos (horse_id);
create index if not exists horse_videos_qualifier_id_idx on public.horse_videos (qualifier_id);
create index if not exists horse_videos_created_at_idx on public.horse_videos (created_at desc);

alter table public.horse_videos enable row level security;

drop policy if exists "horse_videos_select_own" on public.horse_videos;
create policy "horse_videos_select_own"
on public.horse_videos for select
using (auth.uid() = user_id);

drop policy if exists "horse_videos_insert_own" on public.horse_videos;
create policy "horse_videos_insert_own"
on public.horse_videos for insert
with check (auth.uid() = user_id);

drop policy if exists "horse_videos_update_own" on public.horse_videos;
create policy "horse_videos_update_own"
on public.horse_videos for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "horse_videos_delete_own" on public.horse_videos;
create policy "horse_videos_delete_own"
on public.horse_videos for delete
using (auth.uid() = user_id);
