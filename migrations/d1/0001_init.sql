-- KlipKlop D1 schema (SQLite). Groundwork copy of live app tables.
-- No RLS: the utilities Worker will enforce access later.
-- jsonb → TEXT, uuid → TEXT, timestamptz → TEXT, boolean → INTEGER.

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  rider_name TEXT,
  province TEXT,
  age_category TEXT,
  role TEXT,
  status TEXT,
  profile_photo_url TEXT,
  has_seen_tutorial INTEGER,
  subscription_status TEXT,
  paystack_subscription_code TEXT,
  paystack_customer_code TEXT,
  subscription_end_at TEXT,
  paygate_exempt INTEGER,
  created_at TEXT,
  updated_at TEXT,
  extra TEXT
);

CREATE TABLE IF NOT EXISTS horses (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  name TEXT,
  breed TEXT,
  sex TEXT,
  dob TEXT,
  birth_year INTEGER,
  color TEXT,
  microchip_or_passport TEXT,
  photo_url TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS horse_rider_combos (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  horse_id TEXT,
  horse_name TEXT,
  current_level INTEGER,
  is_pinned INTEGER,
  is_archived INTEGER,
  managed_rider_id TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS qualifier_events (
  id TEXT PRIMARY KEY,
  date TEXT,
  venue TEXT,
  province TEXT,
  qualifier_number INTEGER,
  event_type TEXT,
  notes TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS qualifier_results (
  id TEXT PRIMARY KEY,
  combo_id TEXT,
  event_id TEXT,
  game TEXT,
  time REAL,
  is_nt INTEGER,
  level INTEGER,
  penalties REAL,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS personal_bests (
  id TEXT PRIMARY KEY,
  combo_id TEXT,
  game TEXT,
  best_time REAL,
  season_year INTEGER,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  type TEXT,
  message TEXT,
  link TEXT,
  is_read INTEGER,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY,
  title TEXT,
  body TEXT,
  is_pinned INTEGER,
  expires_at TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS bookmarked_events (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  event_id TEXT,
  combo_id TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS club_member_links (
  id TEXT PRIMARY KEY,
  club_head_id TEXT,
  rider_id TEXT,
  status TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS club_managed_riders (
  id TEXT PRIMARY KEY,
  club_head_id TEXT,
  rider_name TEXT,
  age_category TEXT,
  province TEXT,
  profile_photo_url TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS supporter_rider_links (
  id TEXT PRIMARY KEY,
  supporter_id TEXT,
  rider_id TEXT,
  status TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS user_friendships (
  id TEXT PRIMARY KEY,
  requester_id TEXT,
  addressee_id TEXT,
  status TEXT,
  created_at TEXT,
  responded_at TEXT
);

CREATE TABLE IF NOT EXISTS friend_reactions (
  id TEXT PRIMARY KEY,
  from_user_id TEXT,
  to_user_id TEXT,
  reaction TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS friend_messages (
  id TEXT PRIMARY KEY,
  sender_id TEXT,
  receiver_id TEXT,
  message_text TEXT,
  message_type TEXT,
  attachment_url TEXT,
  attachment_meta TEXT,
  read_at TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS horse_medical_entries (
  id TEXT PRIMARY KEY,
  horse_id TEXT,
  user_id TEXT,
  type TEXT,
  title TEXT,
  date TEXT,
  notes TEXT,
  vital_type TEXT,
  vital_value REAL,
  vital_text_value TEXT,
  recorded_at TEXT,
  is_abnormal INTEGER,
  abnormal_reason TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS horse_reminders (
  id TEXT PRIMARY KEY,
  horse_id TEXT,
  user_id TEXT,
  label TEXT,
  due_date TEXT,
  is_done INTEGER,
  reminder_type TEXT,
  last_done_date TEXT,
  next_due_date TEXT,
  vet_name TEXT,
  notes TEXT,
  is_primary_course_complete INTEGER,
  notification_days_before TEXT,
  custom_label TEXT,
  interval_value INTEGER,
  interval_unit TEXT,
  metadata TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS vaccination_log (
  id TEXT PRIMARY KEY,
  horse_id TEXT,
  user_id TEXT,
  vaccination_type TEXT,
  dose_number INTEGER,
  date_administered TEXT,
  vet_name TEXT,
  notes TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS horse_videos (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  horse_id TEXT,
  qualifier_id TEXT,
  video_url TEXT,
  title TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS event_day_results (
  id TEXT PRIMARY KEY,
  combo_id TEXT,
  event_id TEXT,
  game TEXT,
  time REAL,
  is_nt INTEGER,
  level_entered INTEGER,
  level_achieved INTEGER,
  run_number INTEGER,
  rider_name TEXT,
  horse_name TEXT,
  saved_at TEXT
);

CREATE TABLE IF NOT EXISTS event_day_sessions (
  id TEXT PRIMARY KEY,
  token TEXT UNIQUE,
  created_by TEXT,
  primary_event_id TEXT,
  secondary_event_id TEXT,
  is_back_to_back INTEGER,
  entries TEXT,
  selected_entry_keys TEXT,
  expires_at TEXT,
  revoked_at TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS event_day_helper_times (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  device_id TEXT,
  entry_key TEXT,
  event_id TEXT,
  game TEXT,
  time REAL,
  is_nt INTEGER,
  helper_label TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS times_share_links (
  id TEXT PRIMARY KEY,
  token TEXT UNIQUE,
  combo_id TEXT,
  created_by TEXT,
  link_type TEXT,
  expires_at TEXT,
  max_views INTEGER,
  view_count INTEGER,
  revoked_at TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  endpoint TEXT,
  p256dh TEXT,
  auth TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS problem_reports (
  id TEXT PRIMARY KEY,
  category TEXT,
  description TEXT,
  page_path TEXT,
  user_id TEXT,
  reporter_name TEXT,
  reporter_email TEXT,
  visitor_id TEXT,
  context TEXT,
  user_agent TEXT,
  status TEXT,
  admin_notes TEXT,
  resolved_at TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS klippies_waitlist (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  surname TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS klippies_access_requests (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  approved_at TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS klippies_events (
  id TEXT PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  query_len INTEGER,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS profile_access_grants (
  id TEXT PRIMARY KEY,
  admin_id TEXT,
  user_id TEXT,
  status TEXT,
  duration_preset TEXT,
  requested_hours INTEGER,
  reason TEXT,
  created_at TEXT,
  responded_at TEXT,
  expires_at TEXT,
  revoked_at TEXT,
  revoked_by TEXT
);

CREATE TABLE IF NOT EXISTS staged_edit_sessions (
  id TEXT PRIMARY KEY,
  grant_id TEXT,
  admin_id TEXT,
  user_id TEXT,
  status TEXT,
  created_at TEXT,
  submitted_at TEXT,
  decided_at TEXT
);

CREATE TABLE IF NOT EXISTS staged_edit_items (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  table_name TEXT,
  operation TEXT,
  payload TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS horse_times (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  time_seconds REAL,
  created_at TEXT
);

CREATE INDEX IF NOT EXISTS horses_user_id_idx ON horses (user_id);
CREATE INDEX IF NOT EXISTS combos_user_id_idx ON horse_rider_combos (user_id);
CREATE INDEX IF NOT EXISTS qualifier_results_combo_idx ON qualifier_results (combo_id);
CREATE INDEX IF NOT EXISTS personal_bests_combo_idx ON personal_bests (combo_id);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id);
CREATE INDEX IF NOT EXISTS klippies_events_visitor_idx ON klippies_events (visitor_id);
CREATE INDEX IF NOT EXISTS klippies_waitlist_email_idx ON klippies_waitlist (email);
