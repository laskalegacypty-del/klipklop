-- Add season_year to personal_bests to enable year-based filtering.
-- Run this in the Supabase SQL editor.

-- 1. Add the column (defaults to current calendar year for existing rows)
ALTER TABLE public.personal_bests
ADD COLUMN IF NOT EXISTS season_year integer NOT NULL DEFAULT EXTRACT(YEAR FROM NOW())::integer;

-- 2. Drop the old unique constraint (combo_id, game) if it exists
ALTER TABLE public.personal_bests
DROP CONSTRAINT IF EXISTS personal_bests_combo_id_game_key;

-- 3. Create the new unique constraint that includes season_year
ALTER TABLE public.personal_bests
ADD CONSTRAINT personal_bests_combo_id_game_year_key
UNIQUE (combo_id, game, season_year);

-- 4. Index for fast year-scoped lookups
CREATE INDEX IF NOT EXISTS personal_bests_combo_year_idx
ON public.personal_bests (combo_id, season_year);
