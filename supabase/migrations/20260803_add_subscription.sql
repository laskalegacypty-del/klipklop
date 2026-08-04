alter table profiles
  add column if not exists subscription_status        text not null default 'none',
  add column if not exists paystack_subscription_code text,
  add column if not exists paystack_customer_code     text,
  add column if not exists subscription_end_at        timestamptz;

-- SECURITY DEFINER helper: paystack-webhook looks up a user by email
create or replace function get_profile_id_by_email(p_email text)
returns uuid language sql security definer stable as $$
  select p.id from profiles p
  join auth.users u on u.id = p.id
  where u.email = p_email limit 1;
$$;
revoke execute on function get_profile_id_by_email(text) from public, anon, authenticated;
grant  execute on function get_profile_id_by_email(text) to service_role;
