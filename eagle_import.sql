-- ============================================================
-- KlipKlop: Eagle Qualifier Results Import (v2)
-- Rider: Liani Van Der Walt | Horse: Eagle | Level 4
-- combo_id: 87be9ee9-dfb5-4d39-84f8-5714f7bf38b0
-- ============================================================
-- 
-- NOTES:
-- • Event dates are estimated — adjust if you know exact dates.
-- • Uses existing Meyerton Q1 event for 2025.
-- • Creates new events for everything else.
-- • Run in the Supabase SQL Editor.
-- ============================================================

DO $$
DECLARE
  eagle_combo_id UUID := '87be9ee9-dfb5-4d39-84f8-5714f7bf38b0';
  v_event_id UUID;
BEGIN

  -- ════════════════════════════════════════════════════════
  -- 2023 SEASON
  -- ════════════════════════════════════════════════════════

  -- ── Vryburg Q3 (2023-03-18) ──
  -- Creating NEW event
  INSERT INTO qualifier_events (date, province, venue, qualifier_number, event_type)
  VALUES ('2023-03-18', 'North West', 'Vryburg', 3, 'qualifier')
  RETURNING id INTO v_event_id;

  INSERT INTO qualifier_results (combo_id, event_id, game, time, is_nt, level_entered, level_achieved, penalties)
  VALUES
    (eagle_combo_id, v_event_id, 'Big T', 17.359, false, 0, 3, 0),
    (eagle_combo_id, v_event_id, 'Fig 8 Flags', 14.413, false, 0, 4, 0),
    (eagle_combo_id, v_event_id, 'Poles II', 25.154, false, 0, 4, 0),
    (eagle_combo_id, v_event_id, 'Speed Barrels', 11.058, false, 0, 3, 0),
    (eagle_combo_id, v_event_id, 'Speedball', 9.145, false, 0, 3, 0);

  -- ── Bloemhof Q2 (2023-04-22) ──
  -- Creating NEW event
  INSERT INTO qualifier_events (date, province, venue, qualifier_number, event_type)
  VALUES ('2023-04-22', 'North West', 'Bloemhof', 2, 'qualifier')
  RETURNING id INTO v_event_id;

  INSERT INTO qualifier_results (combo_id, event_id, game, time, is_nt, level_entered, level_achieved, penalties)
  VALUES
    (eagle_combo_id, v_event_id, 'Barrel Race', 22.125, false, 0, 3, 0),
    (eagle_combo_id, v_event_id, 'Fig 8 Stake', 12.115, false, 0, 4, 0),
    (eagle_combo_id, v_event_id, 'Keyhole', 9.173, false, 0, 3, 0),
    (eagle_combo_id, v_event_id, 'Poles I', 12.364, false, 0, 3, 0),
    (eagle_combo_id, v_event_id, 'Speedball', 8.005, false, 0, 4, 0);

  -- ── Bloemhof Q6 (2023-06-10) ──
  -- Creating NEW event
  INSERT INTO qualifier_events (date, province, venue, qualifier_number, event_type)
  VALUES ('2023-06-10', 'North West', 'Bloemhof', 6, 'qualifier')
  RETURNING id INTO v_event_id;

  INSERT INTO qualifier_results (combo_id, event_id, game, time, is_nt, level_entered, level_achieved, penalties)
  VALUES
    (eagle_combo_id, v_event_id, 'Big T', 17.734, false, 0, 3, 0),
    (eagle_combo_id, v_event_id, 'Fig 8 Flags', 15.67, false, 0, 3, 0),
    (eagle_combo_id, v_event_id, 'Hurry Scurry', 27.474, false, 0, 0, 0),
    (eagle_combo_id, v_event_id, 'Poles II', 25.443, false, 0, 3, 0),
    (eagle_combo_id, v_event_id, 'Single Stake', 10.191, false, 0, 4, 0);

  -- ── Vryburg Q4 (2023-07-15) ──
  -- Creating NEW event
  INSERT INTO qualifier_events (date, province, venue, qualifier_number, event_type)
  VALUES ('2023-07-15', 'North West', 'Vryburg', 4, 'qualifier')
  RETURNING id INTO v_event_id;

  INSERT INTO qualifier_results (combo_id, event_id, game, time, is_nt, level_entered, level_achieved, penalties)
  VALUES
    (eagle_combo_id, v_event_id, 'Birangle', 16.241, false, 0, 3, 0),
    (eagle_combo_id, v_event_id, 'Hurry Scurry', 14.087, false, 0, 2, 0),
    (eagle_combo_id, v_event_id, 'Keyhole', 8.871, false, 0, 3, 0),
    (eagle_combo_id, v_event_id, 'Quadrangle', 22.798, false, 0, 3, 0),
    (eagle_combo_id, v_event_id, 'Speed Barrels', 11.005, false, 0, 4, 0);

  -- ════════════════════════════════════════════════════════
  -- 2024 SEASON
  -- ════════════════════════════════════════════════════════

  -- ── Nationals NATIONALS (2024-10-05) ──
  -- Creating NEW event
  INSERT INTO qualifier_events (date, province, venue, qualifier_number, event_type)
  VALUES ('2024-10-05', 'North West', 'Nationals', NULL, 'nationals')
  RETURNING id INTO v_event_id;

  INSERT INTO qualifier_results (combo_id, event_id, game, time, is_nt, level_entered, level_achieved, penalties)
  VALUES
    (eagle_combo_id, v_event_id, 'Barrel Race', 19.87, false, 0, 4, 0),
    (eagle_combo_id, v_event_id, 'Birangle', 14.571, false, 0, 4, 0),
    (eagle_combo_id, v_event_id, 'Big T', 17.901, false, 0, 3, 0),
    (eagle_combo_id, v_event_id, 'Fig 8 Stake', 11.907, false, 0, 4, 0),
    (eagle_combo_id, v_event_id, 'Fig 8 Flags', 26.238, false, 0, 1, 0),
    (eagle_combo_id, v_event_id, 'Hurry Scurry', 15.093, false, 0, 1, 0),
    (eagle_combo_id, v_event_id, 'Poles I', 11.398, false, 0, 4, 0),
    (eagle_combo_id, v_event_id, 'Poles II', 24.715, false, 0, 4, 0),
    (eagle_combo_id, v_event_id, 'Quadrangle', 20.864, false, 0, 4, 0),
    (eagle_combo_id, v_event_id, 'Single Stake', 9.642, false, 0, 4, 0),
    (eagle_combo_id, v_event_id, 'Speed Barrels', 10.48, false, 0, 4, 0),
    (eagle_combo_id, v_event_id, 'Speedball', 8.466, false, 0, 4, 0);

  -- ── Potchefstroom Q3 (2024-03-09) ──
  -- Creating NEW event
  INSERT INTO qualifier_events (date, province, venue, qualifier_number, event_type)
  VALUES ('2024-03-09', 'North West', 'Potchefstroom', 3, 'qualifier')
  RETURNING id INTO v_event_id;

  INSERT INTO qualifier_results (combo_id, event_id, game, time, is_nt, level_entered, level_achieved, penalties)
  VALUES
    (eagle_combo_id, v_event_id, 'Big T', 16.518, false, 0, 4, 0),
    (eagle_combo_id, v_event_id, 'Fig 8 Flags', 14.668, false, 0, 4, 0),
    (eagle_combo_id, v_event_id, 'Poles II', 23.456, false, 0, 4, 0),
    (eagle_combo_id, v_event_id, 'Speed Barrels', 10.466, false, 0, 4, 0);

  -- ── Potchefstroom Q4 (2024-03-09) ──
  -- Creating NEW event
  INSERT INTO qualifier_events (date, province, venue, qualifier_number, event_type)
  VALUES ('2024-03-09', 'North West', 'Potchefstroom', 4, 'qualifier')
  RETURNING id INTO v_event_id;

  INSERT INTO qualifier_results (combo_id, event_id, game, time, is_nt, level_entered, level_achieved, penalties)
  VALUES
    (eagle_combo_id, v_event_id, 'Birangle', 14.893, false, 0, 4, 0),
    (eagle_combo_id, v_event_id, 'Hurry Scurry', 13.816, false, 0, 2, 0),
    (eagle_combo_id, v_event_id, 'Keyhole', 8.686, false, 0, 3, 0),
    (eagle_combo_id, v_event_id, 'Quadrangle', 21.275, false, 0, 4, 0),
    (eagle_combo_id, v_event_id, 'Single Stake', 9.838, false, 0, 4, 0);

  -- ── Vryburg Q1 (2024-04-13) ──
  -- Creating NEW event
  INSERT INTO qualifier_events (date, province, venue, qualifier_number, event_type)
  VALUES ('2024-04-13', 'North West', 'Vryburg', 1, 'qualifier')
  RETURNING id INTO v_event_id;

  INSERT INTO qualifier_results (combo_id, event_id, game, time, is_nt, level_entered, level_achieved, penalties)
  VALUES
    (eagle_combo_id, v_event_id, 'Birangle', 15.903, false, 0, 3, 0),
    (eagle_combo_id, v_event_id, 'Fig 8 Flags', 31.016, false, 0, 0, 0),
    (eagle_combo_id, v_event_id, 'Hurry Scurry', 11.657, false, 0, 3, 0),
    (eagle_combo_id, v_event_id, 'Quadrangle', 22.831, false, 0, 3, 0),
    (eagle_combo_id, v_event_id, 'Single Stake', 10.31, false, 0, 4, 0);

  -- ── Vryburg Q2 (2024-04-13) ──
  -- Creating NEW event
  INSERT INTO qualifier_events (date, province, venue, qualifier_number, event_type)
  VALUES ('2024-04-13', 'North West', 'Vryburg', 2, 'qualifier')
  RETURNING id INTO v_event_id;

  INSERT INTO qualifier_results (combo_id, event_id, game, time, is_nt, level_entered, level_achieved, penalties)
  VALUES
    (eagle_combo_id, v_event_id, 'Barrel Race', 20.73, false, 0, 4, 0),
    (eagle_combo_id, v_event_id, 'Fig 8 Stake', 12.289, false, 0, 4, 0),
    (eagle_combo_id, v_event_id, 'Keyhole', 9.238, false, 0, 3, 0),
    (eagle_combo_id, v_event_id, 'Poles I', 12.601, false, 0, 3, 0),
    (eagle_combo_id, v_event_id, 'Speedball', 8.199, false, 0, 4, 0);

  -- ── Bloemhof Q3 (2024-05-18) ──
  -- Creating NEW event
  INSERT INTO qualifier_events (date, province, venue, qualifier_number, event_type)
  VALUES ('2024-05-18', 'North West', 'Bloemhof', 3, 'qualifier')
  RETURNING id INTO v_event_id;

  INSERT INTO qualifier_results (combo_id, event_id, game, time, is_nt, level_entered, level_achieved, penalties)
  VALUES
    (eagle_combo_id, v_event_id, 'Big T', 17.521, false, 0, 3, 0),
    (eagle_combo_id, v_event_id, 'Fig 8 Flags', 25.145, false, 0, 1, 0),
    (eagle_combo_id, v_event_id, 'Poles II', 25.381, false, 0, 4, 0),
    (eagle_combo_id, v_event_id, 'Speed Barrels', 10.691, false, 0, 4, 0),
    (eagle_combo_id, v_event_id, 'Speedball', 8.016, false, 0, 4, 0);

  -- ── Bloemhof Q4 (2024-05-18) ──
  -- Creating NEW event
  INSERT INTO qualifier_events (date, province, venue, qualifier_number, event_type)
  VALUES ('2024-05-18', 'North West', 'Bloemhof', 4, 'qualifier')
  RETURNING id INTO v_event_id;

  INSERT INTO qualifier_results (combo_id, event_id, game, time, is_nt, level_entered, level_achieved, penalties)
  VALUES
    (eagle_combo_id, v_event_id, 'Birangle', 15.279, false, 0, 4, 0),
    (eagle_combo_id, v_event_id, 'Hurry Scurry', 12.613, false, 0, 3, 0),
    (eagle_combo_id, v_event_id, 'Keyhole', 9.684, false, 0, 2, 0),
    (eagle_combo_id, v_event_id, 'Quadrangle', 21.847, false, 0, 4, 0);

  -- ── Bloemhof Q5 (2024-06-15) ──
  -- Creating NEW event
  INSERT INTO qualifier_events (date, province, venue, qualifier_number, event_type)
  VALUES ('2024-06-15', 'North West', 'Bloemhof', 5, 'qualifier')
  RETURNING id INTO v_event_id;

  INSERT INTO qualifier_results (combo_id, event_id, game, time, is_nt, level_entered, level_achieved, penalties)
  VALUES
    (eagle_combo_id, v_event_id, 'Barrel Race', 20.869, false, 0, 4, 0),
    (eagle_combo_id, v_event_id, 'Fig 8 Stake', 12.46, false, 0, 3, 0),
    (eagle_combo_id, v_event_id, 'Keyhole', 9.072, false, 0, 3, 0),
    (eagle_combo_id, v_event_id, 'Poles I', 11.973, false, 0, 4, 0),
    (eagle_combo_id, v_event_id, 'Speedball', 8.059, false, 0, 4, 0);

  -- ── Bloemhof Q6 (2024-06-15) ──
  -- Creating NEW event
  INSERT INTO qualifier_events (date, province, venue, qualifier_number, event_type)
  VALUES ('2024-06-15', 'North West', 'Bloemhof', 6, 'qualifier')
  RETURNING id INTO v_event_id;

  INSERT INTO qualifier_results (combo_id, event_id, game, time, is_nt, level_entered, level_achieved, penalties)
  VALUES
    (eagle_combo_id, v_event_id, 'Big T', 16.259, false, 0, 4, 0),
    (eagle_combo_id, v_event_id, 'Fig 8 Flags', 15.522, false, 0, 3, 0),
    (eagle_combo_id, v_event_id, 'Hurry Scurry', 11.037, false, 0, 4, 0),
    (eagle_combo_id, v_event_id, 'Poles II', 26.138, false, 0, 3, 0);

  -- ════════════════════════════════════════════════════════
  -- 2025 SEASON
  -- ════════════════════════════════════════════════════════

  -- ── Meyerton Q1 (2025-02-15) ──
  -- Using EXISTING event: 8dd662bb-f025-4c98-8e3f-64d77a3dfc99
  v_event_id := '8dd662bb-f025-4c98-8e3f-64d77a3dfc99';

  INSERT INTO qualifier_results (combo_id, event_id, game, time, is_nt, level_entered, level_achieved, penalties)
  VALUES
    (eagle_combo_id, v_event_id, 'Birangle', 16.827, false, 0, 2, 0),
    (eagle_combo_id, v_event_id, 'Fig 8 Flags', 13.865, false, 0, 4, 0),
    (eagle_combo_id, v_event_id, 'Hurry Scurry', 10.399, false, 0, 4, 0),
    (eagle_combo_id, v_event_id, 'Quadrangle', 20.644, false, 0, 4, 0),
    (eagle_combo_id, v_event_id, 'Single Stake', 10.282, false, 0, 4, 0);

  -- ── Meyerton Q2 (2025-02-15) ──
  -- Creating NEW event
  INSERT INTO qualifier_events (date, province, venue, qualifier_number, event_type)
  VALUES ('2025-02-15', 'Gauteng', 'Meyerton', 2, 'qualifier')
  RETURNING id INTO v_event_id;

  INSERT INTO qualifier_results (combo_id, event_id, game, time, is_nt, level_entered, level_achieved, penalties)
  VALUES
    (eagle_combo_id, v_event_id, 'Barrel Race', 20.72, false, 0, 4, 0),
    (eagle_combo_id, v_event_id, 'Fig 8 Stake', 11.657, false, 0, 4, 0),
    (eagle_combo_id, v_event_id, 'Keyhole', 8.811, false, 0, 3, 0),
    (eagle_combo_id, v_event_id, 'Poles I', 11.715, false, 0, 4, 0),
    (eagle_combo_id, v_event_id, 'Speedball', 7.878, false, 0, 4, 0);

  -- ── Sasolburg Q3 (2025-03-15) ──
  -- Creating NEW event
  INSERT INTO qualifier_events (date, province, venue, qualifier_number, event_type)
  VALUES ('2025-03-15', 'Free State', 'Sasolburg', 3, 'qualifier')
  RETURNING id INTO v_event_id;

  INSERT INTO qualifier_results (combo_id, event_id, game, time, is_nt, level_entered, level_achieved, penalties)
  VALUES
    (eagle_combo_id, v_event_id, 'Big T', 17.621, false, 0, 3, 0),
    (eagle_combo_id, v_event_id, 'Fig 8 Flags', 13.362, false, 0, 4, 0),
    (eagle_combo_id, v_event_id, 'Poles II', 26.225, false, 0, 3, 0),
    (eagle_combo_id, v_event_id, 'Speed Barrels', 10.896, false, 0, 4, 0),
    (eagle_combo_id, v_event_id, 'Speedball', 8.212, false, 0, 4, 0);

  -- ── Sasolburg Q4 (2025-03-15) ──
  -- Creating NEW event
  INSERT INTO qualifier_events (date, province, venue, qualifier_number, event_type)
  VALUES ('2025-03-15', 'Free State', 'Sasolburg', 4, 'qualifier')
  RETURNING id INTO v_event_id;

  INSERT INTO qualifier_results (combo_id, event_id, game, time, is_nt, level_entered, level_achieved, penalties)
  VALUES
    (eagle_combo_id, v_event_id, 'Birangle', 15.397, false, 0, 4, 0),
    (eagle_combo_id, v_event_id, 'Hurry Scurry', 15.355, false, 0, 1, 0),
    (eagle_combo_id, v_event_id, 'Keyhole', 8.642, false, 0, 3, 0),
    (eagle_combo_id, v_event_id, 'Quadrangle', 22.391, false, 0, 3, 0),
    (eagle_combo_id, v_event_id, 'Single Stake', 10.552, false, 0, 4, 0);

  -- ── Bethlehem Q5 (2025-04-12) ──
  -- Creating NEW event
  INSERT INTO qualifier_events (date, province, venue, qualifier_number, event_type)
  VALUES ('2025-04-12', 'Free State', 'Bethlehem', 5, 'qualifier')
  RETURNING id INTO v_event_id;

  INSERT INTO qualifier_results (combo_id, event_id, game, time, is_nt, level_entered, level_achieved, penalties)
  VALUES
    (eagle_combo_id, v_event_id, 'Barrel Race', 32.897, false, 0, 0, 0),
    (eagle_combo_id, v_event_id, 'Fig 8 Stake', 12.361, false, 0, 4, 0),
    (eagle_combo_id, v_event_id, 'Keyhole', 10.469, false, 0, 2, 0),
    (eagle_combo_id, v_event_id, 'Poles I', 13.333, false, 0, 2, 0),
    (eagle_combo_id, v_event_id, 'Speedball', 8.113, false, 0, 4, 0);

  -- ── Bethlehem Q6 (2025-04-12) ──
  -- Creating NEW event
  INSERT INTO qualifier_events (date, province, venue, qualifier_number, event_type)
  VALUES ('2025-04-12', 'Free State', 'Bethlehem', 6, 'qualifier')
  RETURNING id INTO v_event_id;

  INSERT INTO qualifier_results (combo_id, event_id, game, time, is_nt, level_entered, level_achieved, penalties)
  VALUES
    (eagle_combo_id, v_event_id, 'Big T', 18.609, false, 0, 2, 0),
    (eagle_combo_id, v_event_id, 'Fig 8 Flags', 14.984, false, 0, 3, 0),
    (eagle_combo_id, v_event_id, 'Hurry Scurry', 16.012, false, 0, 1, 0),
    (eagle_combo_id, v_event_id, 'Poles II', 25.935, false, 0, 3, 0),
    (eagle_combo_id, v_event_id, 'Speed Barrels', 10.657, false, 0, 4, 0);

  RAISE NOTICE 'Eagle import complete! % events, % results inserted.',
    19, 99;

END $$;