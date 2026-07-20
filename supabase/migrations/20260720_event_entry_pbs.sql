-- SECURITY DEFINER function to fetch PBs for any rider/horse combo by name.
-- Called by authenticated organisers so they can see ALL riders' PBs,
-- not only their own horse_rider_combos.

create or replace function get_event_entry_pbs(p_entries jsonb)
returns jsonb
language plpgsql
security definer
stable
as $$
declare
  v_result  jsonb := '{}'::jsonb;
  v_entry   jsonb;
  v_key     text;
  v_rider   text;
  v_horse   text;
  v_combo   uuid;
  v_pbs     jsonb;
begin
  for v_entry in select value from jsonb_array_elements(p_entries)
  loop
    v_key   := v_entry->>'key';
    v_rider := lower(trim(v_entry->>'riderName'));
    v_horse := lower(trim(v_entry->>'horseName'));

    -- Case-insensitive name match across all users' combos
    select id into v_combo
    from horse_rider_combos
    where lower(trim(rider_name)) = v_rider
      and lower(trim(horse_name)) = v_horse
      and is_archived = false
    order by created_at desc
    limit 1;

    if v_combo is not null then
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'game',        game,
          'best_time',   best_time,
          'season_year', season_year
        )
      ), '[]'::jsonb)
      into v_pbs
      from personal_bests
      where combo_id = v_combo;

      v_result := v_result || jsonb_build_object(v_key, v_pbs);
    end if;
  end loop;

  return v_result;
end;
$$;

-- Only authenticated users may call this (not anon / helper links)
revoke execute on function get_event_entry_pbs(jsonb) from public, anon;
grant  execute on function get_event_entry_pbs(jsonb) to authenticated;
