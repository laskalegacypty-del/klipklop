-- Klippies access request gate
-- Anyone can submit a request; only admins can read or update.

create table if not exists klippies_access_requests (
  id          uuid default uuid_generate_v4() primary key,
  created_at  timestamptz default now() not null,
  name        text not null,
  email       text not null,
  status      text not null default 'pending'
                check (status in ('pending', 'approved', 'rejected')),
  approved_at timestamptz,
  constraint  klippies_access_email_unique unique (email)
);

alter table klippies_access_requests enable row level security;

-- Public can submit a new request
create policy "public can request klippies access"
  on klippies_access_requests for insert
  with check (true);

-- Only admins can read all requests
create policy "admins can read klippies requests"
  on klippies_access_requests for select
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

-- Only admins can update status (approve / reject)
create policy "admins can update klippies requests"
  on klippies_access_requests for update
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );
