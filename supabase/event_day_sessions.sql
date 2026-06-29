-- Event Day helper share sessions (run in Supabase SQL editor)
create extension if not exists pgcrypto;

create table if not exists public.event_day_sessions (
  id                    uuid primary key default gen_random_uuid(),
  token                 text not null unique,
  created_by            uuid not null references public.profiles (id) on delete cascade,
  primary_event_id      uuid not null references public.qualifier_events (id) on delete cascade,
  secondary_event_id    uuid references public.qualifier_events (id) on delete set null,
  is_back_to_back       boolean not null default false,
  entries               jsonb not null default '[]'::jsonb,
  selected_entry_keys   text[] not null default '{}',
  expires_at            timestamptz not null,
  revoked_at            timestamptz,
  created_at            timestamptz not null default now()
);

create index if not exists event_day_sessions_created_by_idx
  on public.event_day_sessions (created_by);
create index if not exists event_day_sessions_token_idx
  on public.event_day_sessions (token);

create table if not exists public.event_day_helper_times (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references public.event_day_sessions (id) on delete cascade,
  device_id     text not null,
  entry_key     text not null,
  event_id      uuid not null references public.qualifier_events (id) on delete cascade,
  game          text not null,
  time          numeric,
  is_nt         boolean not null default false,
  helper_label  text,
  updated_at    timestamptz not null default now(),
  constraint event_day_helper_times_unique
    unique (session_id, device_id, entry_key, event_id, game)
);

create index if not exists event_day_helper_times_session_id_idx
  on public.event_day_helper_times (session_id);

alter table public.event_day_sessions enable row level security;
alter table public.event_day_helper_times enable row level security;

drop policy if exists "event_day_sessions_select_own" on public.event_day_sessions;
create policy "event_day_sessions_select_own"
on public.event_day_sessions
for select
to authenticated
using (created_by = auth.uid());

drop policy if exists "event_day_sessions_insert_own" on public.event_day_sessions;
create policy "event_day_sessions_insert_own"
on public.event_day_sessions
for insert
to authenticated
with check (created_by = auth.uid());

drop policy if exists "event_day_sessions_update_own" on public.event_day_sessions;
create policy "event_day_sessions_update_own"
on public.event_day_sessions
for update
to authenticated
using (created_by = auth.uid())
with check (created_by = auth.uid());

drop policy if exists "event_day_helper_times_select_own_session" on public.event_day_helper_times;
create policy "event_day_helper_times_select_own_session"
on public.event_day_helper_times
for select
to authenticated
using (
  exists (
    select 1
    from public.event_day_sessions eds
    where eds.id = event_day_helper_times.session_id
      and eds.created_by = auth.uid()
  )
);

-- Validate and load an event day session by token (server API with service role).
create or replace function public.redeem_event_day_session(p_token text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.event_day_sessions%rowtype;
begin
  select *
  into v_session
  from public.event_day_sessions
  where token = p_token
  for update;

  if not found then
    return json_build_object('ok', false, 'reason', 'not_found');
  end if;

  if v_session.revoked_at is not null then
    return json_build_object('ok', false, 'reason', 'revoked');
  end if;

  if v_session.expires_at < now() then
    return json_build_object('ok', false, 'reason', 'expired');
  end if;

  return json_build_object(
    'ok', true,
    'session_id', v_session.id,
    'created_by', v_session.created_by
  );
end;
$$;

grant execute on function public.redeem_event_day_session(text) to service_role;
