// Hand-written to match supabase/migrations/0001_init.sql.
// If you have the Supabase CLI linked, prefer regenerating with:
//   supabase gen types typescript --linked > src/lib/database.types.ts
//
// Every table declares an empty `Relationships` array: we don't model
// foreign-key metadata here, so PostgREST's embedded-resource typing
// (`.select('foo(bar)')`) won't type-check on its own — those call sites
// cast the result manually instead. `Views` is empty (none exist) and
// `Functions` covers the onboarding RPCs so `supabase.rpc(...)` is typed.

export type AccountType = 'checking' | 'savings' | 'credit_card' | 'cash' | 'other'
export type DocumentKind = 'statement' | 'receipt'
export type DocumentStatus = 'pending' | 'parsing' | 'parsed' | 'confirmed' | 'error'
export type RecurringFrequency = 'weekly' | 'biweekly' | 'monthly' | 'yearly'

export interface LineItem {
  name: string
  amount: number
  qty?: number
}

interface HouseholdResult {
  id: string
  name: string
  invite_code: string
}

export interface Database {
  public: {
    Tables: {
      households: {
        Row: { id: string; name: string; invite_code: string; created_at: string }
        Insert: { id?: string; name: string; invite_code: string; created_at?: string }
        Update: Partial<{ name: string; invite_code: string }>
        Relationships: []
      }
      household_members: {
        Row: { household_id: string; user_id: string; display_name: string; created_at: string }
        Insert: { household_id: string; user_id: string; display_name: string; created_at?: string }
        Update: Partial<{ display_name: string }>
        Relationships: []
      }
      accounts: {
        Row: {
          id: string
          household_id: string
          name: string
          institution: string | null
          account_type: AccountType
          created_at: string
        }
        Insert: {
          id?: string
          household_id: string
          name: string
          institution?: string | null
          account_type?: AccountType
          created_at?: string
        }
        Update: Partial<{ name: string; institution: string | null; account_type: AccountType }>
        Relationships: []
      }
      categories: {
        Row: {
          id: string
          household_id: string
          name: string
          color: string
          icon: string
          is_income: boolean
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          household_id: string
          name: string
          color?: string
          icon?: string
          is_income?: boolean
          sort_order?: number
          created_at?: string
        }
        Update: Partial<{
          name: string
          color: string
          icon: string
          is_income: boolean
          sort_order: number
        }>
        Relationships: []
      }
      documents: {
        Row: {
          id: string
          household_id: string
          uploaded_by: string
          kind: DocumentKind
          storage_path: string
          original_filename: string | null
          status: DocumentStatus
          parse_result: unknown | null
          error_message: string | null
          created_at: string
        }
        Insert: {
          id?: string
          household_id: string
          uploaded_by: string
          kind: DocumentKind
          storage_path: string
          original_filename?: string | null
          status?: DocumentStatus
          parse_result?: unknown | null
          error_message?: string | null
          created_at?: string
        }
        Update: Partial<{
          status: DocumentStatus
          parse_result: unknown | null
          error_message: string | null
        }>
        Relationships: []
      }
      transactions: {
        Row: {
          id: string
          household_id: string
          account_id: string | null
          category_id: string | null
          document_id: string | null
          entered_by: string
          occurred_on: string
          amount: number
          description: string
          merchant: string | null
          notes: string | null
          line_items: LineItem[] | null
          dedupe_hash: string
          created_at: string
        }
        Insert: {
          id?: string
          household_id: string
          account_id?: string | null
          category_id?: string | null
          document_id?: string | null
          entered_by: string
          occurred_on: string
          amount: number
          description: string
          merchant?: string | null
          notes?: string | null
          line_items?: LineItem[] | null
          dedupe_hash: string
          created_at?: string
        }
        Update: Partial<{
          account_id: string | null
          category_id: string | null
          occurred_on: string
          amount: number
          description: string
          merchant: string | null
          notes: string | null
          line_items: LineItem[] | null
        }>
        Relationships: []
      }
      merchant_rules: {
        Row: { id: string; household_id: string; merchant_pattern: string; category_id: string; created_at: string }
        Insert: { id?: string; household_id: string; merchant_pattern: string; category_id: string; created_at?: string }
        Update: Partial<{ category_id: string }>
        Relationships: []
      }
      budgets: {
        Row: {
          id: string
          household_id: string
          month: string
          category_id: string | null
          amount: number
          created_at: string
        }
        Insert: {
          id?: string
          household_id: string
          month: string
          category_id?: string | null
          amount: number
          created_at?: string
        }
        Update: Partial<{ amount: number }>
        Relationships: []
      }
      income_targets: {
        Row: { household_id: string; month: string; expected_income: number }
        Insert: { household_id: string; month: string; expected_income?: number }
        Update: Partial<{ expected_income: number }>
        Relationships: []
      }
      recurring_items: {
        Row: {
          id: string
          household_id: string
          name: string
          category_id: string | null
          amount: number
          frequency: RecurringFrequency
          start_date: string
          end_date: string | null
          created_at: string
        }
        Insert: {
          id?: string
          household_id: string
          name: string
          category_id?: string | null
          amount: number
          frequency: RecurringFrequency
          start_date?: string
          end_date?: string | null
          created_at?: string
        }
        Update: Partial<{
          name: string
          category_id: string | null
          amount: number
          frequency: RecurringFrequency
          start_date: string
          end_date: string | null
        }>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      create_household: {
        Args: { household_name: string; member_display_name: string }
        Returns: HouseholdResult[]
      }
      join_household: {
        Args: { code: string; member_display_name: string }
        Returns: HouseholdResult[]
      }
    }
  }
}
