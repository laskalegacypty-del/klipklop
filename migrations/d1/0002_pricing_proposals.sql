-- Counter-proposals submitted from the public /pricing page (Cloudflare D1 / SQLite).
-- json columns are stored as TEXT. status: 'pending' | 'within range' | 'needs review'.
CREATE TABLE IF NOT EXISTS pricing_proposals (
  id TEXT PRIMARY KEY,
  association TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  note TEXT,
  selected_tier TEXT NOT NULL,
  counts TEXT NOT NULL,
  proposed_prices TEXT NOT NULL,
  list_prices TEXT NOT NULL,
  totals TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'within range', 'needs review')),
  ip_hash TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS pricing_proposals_created_idx ON pricing_proposals (created_at DESC);
CREATE INDEX IF NOT EXISTS pricing_proposals_ip_idx ON pricing_proposals (ip_hash, created_at);
CREATE INDEX IF NOT EXISTS pricing_proposals_email_idx ON pricing_proposals (email, created_at);
