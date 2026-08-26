-- User-reported problems: incorrect information, bugs, or UI issues.
-- Anyone can report (including unauthenticated Klippies visitors); only
-- admins can read or update. Inserts happen server-side via service role
-- (bypasses RLS) since not every reporter has a Supabase auth session.

create table if not exists problem_reports (
  id              uuid default uuid_generate_v4() primary key,
  created_at      timestamptz default now() not null,
  category        text not null
                    check (category in ('incorrect_info', 'bug', 'ui_problem', 'other')),
  description     text not null,
  page_path       text,
  user_id         uuid references auth.users(id) on delete set null,
  reporter_name   text,
  reporter_email  text,
  visitor_id      text,
  context         jsonb,
  user_agent      text,
  status          text not null default 'open'
                    check (status in ('open', 'in_progress', 'resolved', 'wont_fix')),
  admin_notes     text,
  resolved_at     timestamptz
);

alter table problem_reports enable row level security;

create index if not exists problem_reports_status_idx on problem_reports (status);
create index if not exists problem_reports_created_at_idx on problem_reports (created_at desc);

-- Only admins can read; inserts are done server-side via service role (bypasses RLS)
create policy "admins can read problem reports"
  on problem_reports for select
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

-- Only admins can update status / notes
create policy "admins can update problem reports"
  on problem_reports for update
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );
