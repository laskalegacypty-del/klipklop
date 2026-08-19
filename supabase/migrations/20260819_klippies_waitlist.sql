-- Klippies launch waitlist signups (public list page at /list)
create table if not exists klippies_waitlist (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  surname text not null,
  email text not null,
  phone text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists klippies_waitlist_email_key
  on klippies_waitlist (lower(email));

alter table klippies_waitlist enable row level security;

-- All access goes through the service-role API endpoint (api/klippies/waitlist.js),
-- so no anon policies are defined here.
