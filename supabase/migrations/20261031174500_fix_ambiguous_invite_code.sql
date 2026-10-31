-- create_household and join_household declare RETURNS TABLE (id, name,
-- invite_code), which implicitly creates PL/pgSQL variables with those same
-- names inside the function body. A bare `where invite_code = ...` is then
-- ambiguous between that output variable and the households.invite_code
-- column, which Postgres rejects at call time (not at CREATE FUNCTION time,
-- since plpgsql doesn't fully validate SQL bodies until first execution) —
-- the exact "column reference \"invite_code\" is ambiguous" error. Qualify
-- the column reference with the table name to disambiguate.

create or replace function create_household(household_name text, member_display_name text)
returns table (id uuid, name text, invite_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  new_household households%rowtype;
  code text;
begin
  if auth.uid() is null then
    raise exception 'must be authenticated';
  end if;

  loop
    code := upper(substr(md5(random()::text), 1, 6));
    exit when not exists (select 1 from households where households.invite_code = code);
  end loop;

  insert into households (name, invite_code) values (household_name, code) returning * into new_household;
  insert into household_members (household_id, user_id, display_name)
    values (new_household.id, auth.uid(), member_display_name);

  return query select new_household.id, new_household.name, new_household.invite_code;
end;
$$;

create or replace function join_household(code text, member_display_name text)
returns table (id uuid, name text, invite_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  target households%rowtype;
begin
  if auth.uid() is null then
    raise exception 'must be authenticated';
  end if;

  select * into target from households where households.invite_code = upper(trim(code));
  if not found then
    raise exception 'invite code not found';
  end if;

  insert into household_members (household_id, user_id, display_name)
    values (target.id, auth.uid(), member_display_name)
  on conflict (household_id, user_id) do update set display_name = excluded.display_name;

  return query select target.id, target.name, target.invite_code;
end;
$$;
