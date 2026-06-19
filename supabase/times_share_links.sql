-- Shareable expiring horse times links (run in Supabase SQL editor)
create extension if not exists pgcrypto;

create table if not exists public.times_share_links (
  id            uuid primary key default gen_random_uuid(),
  token         text not null unique,
  combo_id      uuid not null references public.horse_rider_combos (id) on delete cascade,
  created_by    uuid not null references public.profiles (id) on delete cascade,
  link_type     text not null check (link_type in ('one_time', 'expires')),
  expires_at    timestamptz,
  max_views     int not null default 1 check (max_views > 0),
  view_count    int not null default 0 check (view_count >= 0),
  revoked_at    timestamptz,
  created_at    timestamptz not null default now(),
  constraint times_share_links_expires_chk check (
    link_type <> 'expires' or expires_at is not null
  )
);

create index if not exists times_share_links_combo_id_idx
  on public.times_share_links (combo_id);
create index if not exists times_share_links_created_by_idx
  on public.times_share_links (created_by);
create index if not exists times_share_links_token_idx
  on public.times_share_links (token);

alter table public.times_share_links enable row level security;

-- Returns true when the user owns the combo or is an accepted club head for that rider.
create or replace function public.user_can_manage_combo(p_user_id uuid, p_combo_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.horse_rider_combos hrc
    where hrc.id = p_combo_id
      and (
        hrc.user_id = p_user_id
        or exists (
          select 1
          from public.club_member_links cml
          where cml.club_head_id = p_user_id
            and cml.rider_id = hrc.user_id
            and cml.status = 'accepted'
        )
      )
  );
$$;

drop policy if exists "times_share_links_select_own" on public.times_share_links;
create policy "times_share_links_select_own"
on public.times_share_links
for select
to authenticated
using (
  created_by = auth.uid()
  and public.user_can_manage_combo(auth.uid(), combo_id)
);

drop policy if exists "times_share_links_insert_own" on public.times_share_links;
create policy "times_share_links_insert_own"
on public.times_share_links
for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.user_can_manage_combo(auth.uid(), combo_id)
);

drop policy if exists "times_share_links_update_own" on public.times_share_links;
create policy "times_share_links_update_own"
on public.times_share_links
for update
to authenticated
using (
  created_by = auth.uid()
  and public.user_can_manage_combo(auth.uid(), combo_id)
)
with check (
  created_by = auth.uid()
  and public.user_can_manage_combo(auth.uid(), combo_id)
);

drop policy if exists "times_share_links_delete_own" on public.times_share_links;
create policy "times_share_links_delete_own"
on public.times_share_links
for delete
to authenticated
using (
  created_by = auth.uid()
  and public.user_can_manage_combo(auth.uid(), combo_id)
);

-- Atomically validate and redeem a share token (called from server API with service role).
create or replace function public.redeem_times_share_link(p_token text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.times_share_links%rowtype;
begin
  select *
  into v_link
  from public.times_share_links
  where token = p_token
  for update;

  if not found then
    return json_build_object('ok', false, 'reason', 'not_found');
  end if;

  if v_link.revoked_at is not null then
    return json_build_object('ok', false, 'reason', 'revoked');
  end if;

  if v_link.expires_at is not null and v_link.expires_at < now() then
    return json_build_object('ok', false, 'reason', 'expired');
  end if;

  if v_link.view_count >= v_link.max_views then
    return json_build_object('ok', false, 'reason', 'used');
  end if;

  update public.times_share_links
  set view_count = view_count + 1
  where id = v_link.id;

  return json_build_object(
    'ok', true,
    'combo_id', v_link.combo_id,
    'link_type', v_link.link_type
  );
end;
$$;

grant execute on function public.redeem_times_share_link(text) to service_role;
grant execute on function public.user_can_manage_combo(uuid, uuid) to authenticated;
