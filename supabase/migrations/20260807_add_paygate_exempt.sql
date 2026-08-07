alter table profiles
  add column if not exists paygate_exempt boolean not null default false;
