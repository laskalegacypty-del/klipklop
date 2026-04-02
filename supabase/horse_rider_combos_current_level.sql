-- Add current level (0-4) to horse/rider combos.
-- Run this in the Supabase SQL editor.

alter table public.horse_rider_combos
add column if not exists current_level int not null default 0;

-- Optional safety constraint (uncomment if desired).
-- Note: adding a constraint will fail if any existing rows have invalid values.
-- alter table public.horse_rider_combos
-- add constraint horse_rider_combos_current_level_chk
-- check (current_level between 0 and 4);

