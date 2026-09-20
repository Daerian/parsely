-- Parsely schema: households, shared finance data, RLS.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Households & membership
-- ---------------------------------------------------------------------------

create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

create table household_members (
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create index household_members_user_idx on household_members(user_id);

-- Helper: is the current user a member of this household?
create or replace function is_household_member(hid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from household_members
    where household_id = hid and user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- Accounts (bank accounts / cards)
-- ---------------------------------------------------------------------------

create table accounts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  institution text,
  account_type text not null default 'checking' check (account_type in ('checking', 'savings', 'credit_card', 'cash', 'other')),
  created_at timestamptz not null default now()
);

create index accounts_household_idx on accounts(household_id);

-- ---------------------------------------------------------------------------
-- Categories
-- ---------------------------------------------------------------------------

create table categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  color text not null default '#64748b',
  icon text not null default 'circle',
  is_income boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (household_id, name)
);

create index categories_household_idx on categories(household_id);

-- ---------------------------------------------------------------------------
-- Documents (uploaded statements / receipts)
-- ---------------------------------------------------------------------------

create table documents (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id),
  kind text not null check (kind in ('statement', 'receipt')),
  storage_path text not null,
  original_filename text,
  status text not null default 'pending' check (status in ('pending', 'parsing', 'parsed', 'confirmed', 'error')),
  parse_result jsonb,
  error_message text,
  created_at timestamptz not null default now()
);

create index documents_household_idx on documents(household_id);

-- ---------------------------------------------------------------------------
-- Transactions
-- ---------------------------------------------------------------------------

create table transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  account_id uuid references accounts(id) on delete set null,
  category_id uuid references categories(id) on delete set null,
  document_id uuid references documents(id) on delete set null,
  entered_by uuid not null references auth.users(id),
  occurred_on date not null,
  amount numeric(12, 2) not null, -- negative = spend, positive = income
  description text not null,
  merchant text,
  notes text,
  line_items jsonb, -- receipt detail: [{name, amount, qty}]
  dedupe_hash text not null,
  created_at timestamptz not null default now()
);

create index transactions_household_idx on transactions(household_id);
create index transactions_household_date_idx on transactions(household_id, occurred_on);
create index transactions_household_category_idx on transactions(household_id, category_id);
create unique index transactions_dedupe_idx on transactions(household_id, dedupe_hash);

-- ---------------------------------------------------------------------------
-- Merchant rules (learned categorization)
-- ---------------------------------------------------------------------------

create table merchant_rules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  merchant_pattern text not null, -- normalized (lowercase, trimmed) merchant/description match
  category_id uuid not null references categories(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (household_id, merchant_pattern)
);

create index merchant_rules_household_idx on merchant_rules(household_id);

-- ---------------------------------------------------------------------------
-- Budgets
-- ---------------------------------------------------------------------------

create table budgets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  month date not null, -- always the 1st of the month
  category_id uuid references categories(id) on delete cascade,
  amount numeric(12, 2) not null,
  created_at timestamptz not null default now(),
  unique (household_id, month, category_id)
);

create index budgets_household_month_idx on budgets(household_id, month);

create table income_targets (
  household_id uuid not null references households(id) on delete cascade,
  month date not null,
  expected_income numeric(12, 2) not null default 0,
  primary key (household_id, month)
);

-- ---------------------------------------------------------------------------
-- Recurring items (forecast inputs)
-- ---------------------------------------------------------------------------

create table recurring_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  category_id uuid references categories(id) on delete set null,
  amount numeric(12, 2) not null, -- negative = spend, positive = income
  frequency text not null check (frequency in ('weekly', 'biweekly', 'monthly', 'yearly')),
  start_date date not null default current_date,
  end_date date,
  created_at timestamptz not null default now()
);

create index recurring_items_household_idx on recurring_items(household_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table households enable row level security;
alter table household_members enable row level security;
alter table accounts enable row level security;
alter table categories enable row level security;
alter table documents enable row level security;
alter table transactions enable row level security;
alter table merchant_rules enable row level security;
alter table budgets enable row level security;
alter table income_targets enable row level security;
alter table recurring_items enable row level security;

-- households: members can read; anyone authenticated can create (they become the first member via app logic)
create policy households_select on households for select
  using (is_household_member(id));
create policy households_insert on households for insert
  with check (auth.uid() is not null);
create policy households_update on households for update
  using (is_household_member(id));

-- household_members: members can see other members of their household; users can insert themselves
create policy household_members_select on household_members for select
  using (is_household_member(household_id));
create policy household_members_insert on household_members for insert
  with check (user_id = auth.uid());
create policy household_members_delete on household_members for delete
  using (user_id = auth.uid());

-- Generic per-household CRUD policy, applied to each shared-data table.
do $$
declare
  t text;
begin
  foreach t in array array['accounts', 'categories', 'documents', 'transactions', 'merchant_rules', 'budgets', 'income_targets', 'recurring_items']
  loop
    execute format($f$
      create policy %1$I_select on %1$I for select using (is_household_member(household_id));
      create policy %1$I_insert on %1$I for insert with check (is_household_member(household_id));
      create policy %1$I_update on %1$I for update using (is_household_member(household_id));
      create policy %1$I_delete on %1$I for delete using (is_household_member(household_id));
    $f$, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Storage bucket for uploaded documents
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- Storage paths are namespaced as `${household_id}/${filename}`; a member may
-- read/write objects under their household's folder.
create policy documents_storage_select on storage.objects for select
  using (
    bucket_id = 'documents'
    and is_household_member((storage.foldername(name))[1]::uuid)
  );
create policy documents_storage_insert on storage.objects for insert
  with check (
    bucket_id = 'documents'
    and is_household_member((storage.foldername(name))[1]::uuid)
  );
create policy documents_storage_delete on storage.objects for delete
  using (
    bucket_id = 'documents'
    and is_household_member((storage.foldername(name))[1]::uuid)
  );

-- ---------------------------------------------------------------------------
-- Seed categories on household creation
-- ---------------------------------------------------------------------------

create or replace function seed_default_categories()
returns trigger
language plpgsql
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

create trigger households_seed_categories
  after insert on households
  for each row execute function seed_default_categories();

-- ---------------------------------------------------------------------------
-- Onboarding RPCs
--
-- Household creation and invite-code joining are done via security-definer
-- functions rather than plain inserts: RLS requires membership to SELECT a
-- household, so a plain `insert().select()` (create) or a lookup by code
-- (join) can't succeed for a user who isn't a member yet. These functions
-- run with elevated privilege to bridge that gap, and are the only place
-- that's allowed to happen.
-- ---------------------------------------------------------------------------

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
    exit when not exists (select 1 from households where invite_code = code);
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

  select * into target from households where invite_code = upper(trim(code));
  if not found then
    raise exception 'invite code not found';
  end if;

  insert into household_members (household_id, user_id, display_name)
    values (target.id, auth.uid(), member_display_name)
  on conflict (household_id, user_id) do update set display_name = excluded.display_name;

  return query select target.id, target.name, target.invite_code;
end;
$$;

grant execute on function create_household(text, text) to authenticated;
grant execute on function join_household(text, text) to authenticated;
