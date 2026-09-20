-- Harden function search_path + explicit privilege grants; cache auth.uid()
-- per statement in RLS policies instead of per row; add covering indexes for
-- foreign keys. Addresses findings from the security/performance advisors.

-- 1. seed_default_categories was missing search_path hardening.
create or replace function seed_default_categories()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  insert into categories (household_id, name, color, icon, is_income, sort_order) values
    (new.id, 'Income', '#16a34a', 'wallet', true, 0),
    (new.id, 'Groceries', '#f59e0b', 'shopping-cart', false, 1),
    (new.id, 'Dining', '#ef4444', 'utensils', false, 2),
    (new.id, 'Transport', '#3b82f6', 'car', false, 3),
    (new.id, 'Housing', '#8b5cf6', 'home', false, 4),
    (new.id, 'Utilities', '#0ea5e9', 'plug', false, 5),
    (new.id, 'Entertainment', '#ec4899', 'film', false, 6),
    (new.id, 'Health', '#14b8a6', 'heart-pulse', false, 7),
    (new.id, 'Shopping', '#f97316', 'bag', false, 8),
    (new.id, 'Travel', '#6366f1', 'plane', false, 9),
    (new.id, 'Other', '#64748b', 'circle', false, 10);
  return new;
end;
$$;

-- 2. CREATE FUNCTION grants EXECUTE to PUBLIC by default; restrict these
-- security-definer functions to signed-in users only. (They already guard
-- on auth.uid() internally, so this tightens the API surface rather than
-- closing an actual hole.)
revoke execute on function is_household_member(uuid) from public;
grant execute on function is_household_member(uuid) to authenticated;

revoke execute on function create_household(text, text) from public;
grant execute on function create_household(text, text) to authenticated;

revoke execute on function join_household(text, text) from public;
grant execute on function join_household(text, text) to authenticated;

-- 3. Wrap auth.uid() in a scalar subquery so Postgres evaluates it once per
-- statement rather than re-invoking it for every row.
drop policy households_insert on households;
create policy households_insert on households for insert
  with check ((select auth.uid()) is not null);

drop policy household_members_insert on household_members;
create policy household_members_insert on household_members for insert
  with check (user_id = (select auth.uid()));

drop policy household_members_delete on household_members;
create policy household_members_delete on household_members for delete
  using (user_id = (select auth.uid()));

-- 4. Covering indexes for foreign keys flagged by the performance advisor.
create index budgets_category_idx on budgets(category_id);
create index documents_uploaded_by_idx on documents(uploaded_by);
create index merchant_rules_category_idx on merchant_rules(category_id);
create index recurring_items_category_idx on recurring_items(category_id);
create index transactions_account_idx on transactions(account_id);
create index transactions_category_idx on transactions(category_id);
create index transactions_document_idx on transactions(document_id);
create index transactions_entered_by_idx on transactions(entered_by);
