-- Fix Parys qualifier numbers:
-- Saturday should be Q10, Sunday should be Q9.
-- Run this in Supabase SQL Editor.

update public.qualifier_events
set qualifier_number = case
  when extract(isodow from date::date) = 6 then 10 -- Saturday
  when extract(isodow from date::date) = 7 then 9  -- Sunday
  else qualifier_number
end
where lower(venue) like '%parys%'
  and extract(isodow from date::date) in (6, 7);
