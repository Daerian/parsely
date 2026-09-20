-- Supabase grants EXECUTE on new public-schema functions directly to the
-- anon and authenticated roles (not via PUBLIC), so revoking from PUBLIC
-- alone didn't remove anon's access. These functions are only meant to be
-- called by signed-in users.
revoke execute on function is_household_member(uuid) from anon;
revoke execute on function create_household(text, text) from anon;
revoke execute on function join_household(text, text) from anon;
