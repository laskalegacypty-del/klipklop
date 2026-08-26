-- Klippies usage analytics table
-- Logs anonymous page visits and AI queries from the public /klippies demo page.
-- Visitor identity is a UUID stored in the visitor's localStorage (no auth required).

create table if not exists klippies_events (
  id          uuid default uuid_generate_v4() primary key,
  created_at  timestamptz default now() not null,
  visitor_id  text not null,
  event_type  text not null check (event_type in ('visit', 'ai_query')),
  query_len   smallint    -- character count; only set for ai_query rows
);

alter table klippies_events enable row level security;

-- Only admins can read; inserts are done server-side via service role (bypasses RLS)
create policy "admins can read klippies events"
  on klippies_events for select
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );
