-- household_members had select/insert/delete policies but no update policy,
-- so a member could never change their own display name: RLS would match
-- zero rows and the update would silently no-op rather than error.
--
-- A member may update only their own row. The `with check` clause matters
-- as much as `using` here: without it, someone could reassign their row to
-- another user_id (or another household) as part of the update.
create policy household_members_update on household_members for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
