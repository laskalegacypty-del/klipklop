-- Link horse_rider_combos to the horses table.
-- Run this in the Supabase SQL editor.

alter table public.horse_rider_combos
add column if not exists horse_id uuid references public.horses(id) on delete set null;

create index if not exists horse_rider_combos_horse_id_idx
on public.horse_rider_combos (horse_id);
