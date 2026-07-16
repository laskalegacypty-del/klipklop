create table event_day_results (
  id            uuid primary key default gen_random_uuid(),
  combo_id      uuid references horse_rider_combos(id) on delete cascade,
  event_id      uuid references qualifier_events(id) on delete cascade,
  game          text not null,
  time          numeric,
  is_nt         boolean not null default false,
  level_entered integer not null default 0,
  level_achieved integer,
  run_number    integer,
  rider_name    text,
  horse_name    text,
  saved_at      timestamptz not null default now(),
  unique(combo_id, event_id, game)
);

alter table event_day_results enable row level security;

create policy "event_day_results_owner"
  on event_day_results for all
  using (
    combo_id in (
      select id from horse_rider_combos where user_id = auth.uid()
    )
  );
