-- Rider-only Friends Leaderboard game schema + RPC
-- Run in Supabase SQL editor.

-- =========================
-- user_friendships
-- =========================
create table if not exists public.user_friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending', -- pending | accepted | rejected | blocked
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint user_friendships_no_self check (requester_id <> addressee_id),
  constraint user_friendships_status_check check (status in ('pending', 'accepted', 'rejected', 'blocked'))
);

create unique index if not exists user_friendships_unique_pair_idx
on public.user_friendships (
  least(requester_id, addressee_id),
  greatest(requester_id, addressee_id)
);

create index if not exists user_friendships_requester_idx on public.user_friendships (requester_id);
create index if not exists user_friendships_addressee_idx on public.user_friendships (addressee_id);
create index if not exists user_friendships_status_idx on public.user_friendships (status);

alter table public.user_friendships enable row level security;

drop policy if exists "friendships_select_participants" on public.user_friendships;
create policy "friendships_select_participants"
on public.user_friendships
for select
to authenticated
using (auth.uid() = requester_id or auth.uid() = addressee_id);

drop policy if exists "friendships_insert_requester" on public.user_friendships;
create policy "friendships_insert_requester"
on public.user_friendships
for insert
to authenticated
with check (
  auth.uid() = requester_id
  and exists (
    select 1
    from public.profiles p_req
    where p_req.id = requester_id and p_req.role = 'user'
  )
  and exists (
    select 1
    from public.profiles p_add
    where p_add.id = addressee_id and p_add.role = 'user'
  )
);

drop policy if exists "friendships_update_participants" on public.user_friendships;
create policy "friendships_update_participants"
on public.user_friendships
for update
to authenticated
using (auth.uid() = requester_id or auth.uid() = addressee_id)
with check (auth.uid() = requester_id or auth.uid() = addressee_id);

drop policy if exists "friendships_delete_requester" on public.user_friendships;
create policy "friendships_delete_requester"
on public.user_friendships
for delete
to authenticated
using (auth.uid() = requester_id);

-- =========================
-- Lightweight social reactions on friends
-- =========================
create table if not exists public.friend_reactions (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references public.profiles (id) on delete cascade,
  to_user_id uuid not null references public.profiles (id) on delete cascade,
  reaction text not null,
  created_at timestamptz not null default now(),
  constraint friend_reactions_no_self check (from_user_id <> to_user_id)
);

create index if not exists friend_reactions_to_user_idx on public.friend_reactions (to_user_id, created_at desc);
create index if not exists friend_reactions_from_user_idx on public.friend_reactions (from_user_id, created_at desc);

alter table public.friend_reactions enable row level security;

drop policy if exists "friend_reactions_select_participants" on public.friend_reactions;
create policy "friend_reactions_select_participants"
on public.friend_reactions
for select
to authenticated
using (
  auth.uid() = from_user_id
  or auth.uid() = to_user_id
);

drop policy if exists "friend_reactions_insert_friends_only" on public.friend_reactions;
create policy "friend_reactions_insert_friends_only"
on public.friend_reactions
for insert
to authenticated
with check (
  auth.uid() = from_user_id
  and exists (
    select 1
    from public.user_friendships uf
    where uf.status = 'accepted'
      and (
        (uf.requester_id = from_user_id and uf.addressee_id = to_user_id)
        or (uf.requester_id = to_user_id and uf.addressee_id = from_user_id)
      )
  )
);

-- =========================
-- RPC: Friends leaderboard
-- =========================
drop function if exists public.get_friends_leaderboard(text, integer, text, uuid, integer);
create or replace function public.get_friends_leaderboard(
  p_mode text default 'current_year',      -- current_year | personal_best
  p_year integer default extract(year from now())::integer,
  p_game text default 'all',               -- 'all' or one game name from qualifier_results.game
  p_my_combo_id uuid default null,         -- optional: filter only my selected horse/combo
  p_level_filter integer default null      -- optional: 0..4 to include only results at that achieved level
)
returns table (
  rank bigint,
  combo_id uuid,
  user_id uuid,
  rider_name text,
  horse_name text,
  profile_photo_url text,
  province text,
  games_covered bigint,
  first_places bigint,
  second_places bigint,
  third_places bigint,
  placement_score bigint,
  total_level_points bigint,
  avg_level numeric,
  level4_count bigint,
  total_best_time numeric,
  avg_best_time numeric,
  selected_game_best_time numeric
)
language sql
security definer
set search_path = public
as $$
with me as (
  select auth.uid() as me_id
),
friend_ids as (
  select distinct
    case
      when uf.requester_id = me.me_id then uf.addressee_id
      else uf.requester_id
    end as friend_id
  from public.user_friendships uf
  cross join me
  where uf.status = 'accepted'
    and (uf.requester_id = me.me_id or uf.addressee_id = me.me_id)
),
scope_users as (
  select me_id as user_id from me
  union
  select friend_id as user_id from friend_ids
),
mode_results as (
  select
    hrc.id as combo_id,
    hrc.user_id,
    coalesce(
      nullif(trim(hrc.horse_name), ''),
      nullif(trim(h.name), ''),
      'Unknown horse'
    ) as horse_name,
    qr.game,
    min(qr.time)::numeric as best_time
  from public.qualifier_results qr
  join public.horse_rider_combos hrc on hrc.id = qr.combo_id
  left join public.horses h on h.id = hrc.horse_id
  join public.qualifier_events qe on qe.id = qr.event_id
  join scope_users su on su.user_id = hrc.user_id
  where qr.is_nt = false
    and qr.time is not null
    and (
      (p_mode = 'current_year' and extract(year from qe.date)::integer = p_year)
      or (p_mode = 'personal_best')
    )
    and (
      p_game = 'all'
      or lower(qr.game) = lower(p_game)
    )
    and (
      p_my_combo_id is null
      or hrc.user_id <> (select me_id from me)
      or qr.combo_id = p_my_combo_id
    )
    and (
      p_level_filter is null
      or coalesce(qr.level_achieved, 0) = p_level_filter
    )
  group by hrc.id, hrc.user_id, hrc.horse_name, h.name, qr.game
),
mode_levels as (
  select
    hrc.id as combo_id,
    hrc.user_id,
    coalesce(
      nullif(trim(hrc.horse_name), ''),
      nullif(trim(h.name), ''),
      'Unknown horse'
    ) as horse_name,
    qr.game,
    max(coalesce(qr.level_achieved, 0))::bigint as best_level
  from public.qualifier_results qr
  join public.horse_rider_combos hrc on hrc.id = qr.combo_id
  left join public.horses h on h.id = hrc.horse_id
  join public.qualifier_events qe on qe.id = qr.event_id
  join scope_users su on su.user_id = hrc.user_id
  where qr.is_nt = false
    and qr.time is not null
    and (
      (p_mode = 'current_year' and extract(year from qe.date)::integer = p_year)
      or (p_mode = 'personal_best')
    )
    and (
      p_game = 'all'
      or lower(qr.game) = lower(p_game)
    )
    and (
      p_my_combo_id is null
      or hrc.user_id <> (select me_id from me)
      or qr.combo_id = p_my_combo_id
    )
    and (
      p_level_filter is null
      or coalesce(qr.level_achieved, 0) = p_level_filter
    )
  group by hrc.id, hrc.user_id, hrc.horse_name, h.name, qr.game
),
level_rollup as (
  select
    ml.combo_id,
    ml.user_id,
    ml.horse_name,
    sum(ml.best_level)::bigint as total_level_points,
    avg(ml.best_level::numeric) as avg_level,
    count(*) filter (where ml.best_level = 4)::bigint as level4_count
  from mode_levels ml
  group by ml.combo_id, ml.user_id, ml.horse_name
),
rollup as (
  select
    mr.combo_id,
    mr.user_id,
    mr.horse_name,
    count(*)::bigint as games_covered,
    sum(mr.best_time)::numeric as total_best_time,
    avg(mr.best_time)::numeric as avg_best_time
  from mode_results mr
  group by mr.combo_id, mr.user_id, mr.horse_name
),
game_placements as (
  select
    mr.combo_id,
    mr.user_id,
    mr.horse_name,
    mr.game,
    dense_rank() over (
      partition by mr.game
      order by mr.best_time asc, mr.combo_id asc
    )::bigint as place_position
  from mode_results mr
),
placement_rollup as (
  select
    gp.combo_id,
    gp.user_id,
    gp.horse_name,
    count(*) filter (where gp.place_position = 1)::bigint as first_places,
    count(*) filter (where gp.place_position = 2)::bigint as second_places,
    count(*) filter (where gp.place_position = 3)::bigint as third_places,
    sum(gp.place_position)::bigint as placement_score
  from game_placements gp
  group by gp.combo_id, gp.user_id, gp.horse_name
),
game_best as (
  select
    mr.combo_id,
    mr.user_id,
    mr.horse_name,
    min(mr.best_time)::numeric as selected_game_best_time
  from mode_results mr
  group by mr.combo_id, mr.user_id, mr.horse_name
),
base as (
  select
    r.combo_id,
    p.id as user_id,
    p.rider_name,
    r.horse_name,
    p.profile_photo_url,
    p.province,
    coalesce(r.games_covered, 0)::bigint as games_covered,
    coalesce(pr.first_places, 0)::bigint as first_places,
    coalesce(pr.second_places, 0)::bigint as second_places,
    coalesce(pr.third_places, 0)::bigint as third_places,
    pr.placement_score,
    coalesce(lr.total_level_points, 0)::bigint as total_level_points,
    lr.avg_level,
    coalesce(lr.level4_count, 0)::bigint as level4_count,
    r.total_best_time,
    r.avg_best_time,
    gb.selected_game_best_time
  from rollup r
  join public.profiles p on p.id = r.user_id
  left join placement_rollup pr on pr.combo_id = r.combo_id
  left join level_rollup lr on lr.combo_id = r.combo_id
  left join game_best gb on gb.combo_id = r.combo_id
  where p.role = 'user'
),
ranked as (
  select
    row_number() over (
      order by
        case when games_covered > 0 then 0 else 1 end asc,
        first_places desc,
        second_places desc,
        third_places desc,
        placement_score asc nulls last,
        games_covered desc,
        lower(rider_name) asc,
        combo_id asc
    ) as rank,
    *
  from base
)
select
  r.rank,
  r.combo_id,
  r.user_id,
  r.rider_name,
  r.horse_name,
  r.profile_photo_url,
  r.province,
  r.games_covered,
  r.first_places,
  r.second_places,
  r.third_places,
  r.placement_score,
  r.total_level_points,
  r.avg_level,
  r.level4_count,
  r.total_best_time,
  r.avg_best_time,
  r.selected_game_best_time
from ranked r
order by r.rank;
$$;

revoke all on function public.get_friends_leaderboard(text, integer, text, uuid, integer) from public;
grant execute on function public.get_friends_leaderboard(text, integer, text, uuid, integer) to authenticated;

-- =========================
-- Friend overtake notifications
-- =========================
create unique index if not exists notifications_friend_overtake_unique_idx
on public.notifications (user_id, type, link, message)
where type = 'friend_overtake';

drop policy if exists "notifications_insert_for_friend_overtake" on public.notifications;
create policy "notifications_insert_for_friend_overtake"
on public.notifications
for insert
to authenticated
with check (
  notifications.type = 'friend_overtake'
  and (
    notifications.user_id = auth.uid()
    or exists (
      select 1
      from public.user_friendships uf
      where uf.status = 'accepted'
        and (
          (uf.requester_id = auth.uid() and uf.addressee_id = notifications.user_id)
          or (uf.requester_id = notifications.user_id and uf.addressee_id = auth.uid())
        )
    )
  )
);
