-- SECURITY DEFINER function so the admin can clean up cross-user data
-- when changing a user's role (bypasses RLS safely).
create or replace function admin_role_change_cleanup(
  p_target_user_id uuid,
  p_old_role        text,
  p_new_role        text
)
returns void
language plpgsql
security definer
as $$
begin
  -- Only admins may call this
  if not exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  ) then
    raise exception 'Only admins can perform role change cleanup';
  end if;

  -- Leaving supporter: remove all the rider links they held as supporter
  if p_old_role = 'supporter' then
    delete from supporter_rider_links where supporter_id = p_target_user_id;
  end if;

  -- Leaving club_head: remove all member links under this club head
  if p_old_role = 'club_head' then
    delete from club_member_links where club_head_id = p_target_user_id;
  end if;

  -- Becoming club_head: leave any clubs they were a rider in
  if p_new_role = 'club_head' and p_old_role <> 'club_head' then
    delete from club_member_links where rider_id = p_target_user_id;
  end if;
end;
$$;

-- Keep the old name working too in case anything else calls it
create or replace function migrate_rider_to_club_head(target_user_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  perform admin_role_change_cleanup(target_user_id, 'user', 'club_head');
end;
$$;
