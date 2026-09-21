-- =====================================================================
-- nationals_entries: add `arena`
-- ---------------------------------------------------------------------
-- The original nationals_entries.sql only captured the game name out of
-- each timeslot table's column header (e.g. "Arena 1A (KH)" -> "Keyhole").
-- The Nationals page now also shows which arena a run is in, so this adds
-- the arena label (e.g. "Arena 1A", "Arena 9B") as its own column.
--
-- Run this in the Supabase SQL editor, then the data will be re-seeded
-- with arena values filled in.
-- =====================================================================

alter table public.nationals_entries add column if not exists arena text;
