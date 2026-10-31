import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { useAuth } from './auth'
import { dedupeHash } from './dedupe'
import type {
  AccountType,
  Database,
  RecurringFrequency,
} from './database.types'

type CategoryRow = Database['public']['Tables']['categories']['Row']
type AccountRow = Database['public']['Tables']['accounts']['Row']
type TransactionRow = Database['public']['Tables']['transactions']['Row']
type BudgetRow = Database['public']['Tables']['budgets']['Row']
type RecurringRow = Database['public']['Tables']['recurring_items']['Row']
type DocumentRow = Database['public']['Tables']['documents']['Row']

// ---------------------------------------------------------------------------
// Household members
// ---------------------------------------------------------------------------

export function useHouseholdMembers() {
  const { household } = useAuth()
  return useQuery({
    queryKey: ['household-members', household?.id],
    enabled: !!household,
    queryFn: async (): Promise<{ user_id: string; display_name: string }[]> => {
      const { data, error } = await supabase
        .from('household_members')
        .select('user_id, display_name')
        .eq('household_id', household!.id)
      if (error) throw error
      return data
    },
  })
}

export function useUpdateDisplayName() {
  const { household, user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (displayName: string) => {
      const { data, error } = await supabase
        .from('household_members')
        .update({ display_name: displayName })
        .eq('household_id', household!.id)
        .eq('user_id', user!.id)
        .select('user_id')
      if (error) throw error
      // RLS failures match zero rows rather than erroring, so an empty result
      // means the write was rejected, not that it succeeded with no changes.
      if (!data || data.length === 0) throw new Error('Could not update your name — permission denied.')
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['household-members', household?.id] }),
  })
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export function useCategories() {
  const { household } = useAuth()
  return useQuery({
    queryKey: ['categories', household?.id],
    enabled: !!household,
    queryFn: async (): Promise<CategoryRow[]> => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('household_id', household!.id)
        .order('sort_order')
      if (error) throw error
      return data
    },
  })
}

export function useUpsertCategory() {
  const { household } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id?: string; name: string; color: string; icon: string; isIncome: boolean }) => {
      const { error } = await supabase.from('categories').upsert({
        id: input.id,
        household_id: household!.id,
        name: input.name,
        color: input.color,
        icon: input.icon,
        is_income: input.isIncome,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories', household?.id] }),
  })
}

export function useDeleteCategory() {
  const { household } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('categories').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories', household?.id] }),
  })
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

export function useAccounts() {
  const { household } = useAuth()
  return useQuery({
    queryKey: ['accounts', household?.id],
    enabled: !!household,
    queryFn: async (): Promise<AccountRow[]> => {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('household_id', household!.id)
        .order('created_at')
      if (error) throw error
      return data
    },
  })
}

export function useUpsertAccount() {
  const { household } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id?: string; name: string; institution?: string; accountType: AccountType }) => {
      const { error } = await supabase.from('accounts').upsert({
        id: input.id,
        household_id: household!.id,
        name: input.name,
        institution: input.institution ?? null,
        account_type: input.accountType,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts', household?.id] }),
  })
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

export interface TransactionFilters {
  monthStart?: string // YYYY-MM-DD, inclusive
  monthEnd?: string // YYYY-MM-DD, exclusive
  categoryId?: string
  search?: string
}

export function useTransactions(filters: TransactionFilters = {}) {
  const { household } = useAuth()
  return useQuery({
    queryKey: ['transactions', household?.id, filters],
    enabled: !!household,
    queryFn: async (): Promise<TransactionRow[]> => {
      let query = supabase
        .from('transactions')
        .select('*')
        .eq('household_id', household!.id)
        .order('occurred_on', { ascending: false })

      if (filters.monthStart) query = query.gte('occurred_on', filters.monthStart)
      if (filters.monthEnd) query = query.lt('occurred_on', filters.monthEnd)
      if (filters.categoryId) query = query.eq('category_id', filters.categoryId)
      if (filters.search) query = query.or(`description.ilike.%${filters.search}%,merchant.ilike.%${filters.search}%`)

      const { data, error } = await query
      if (error) throw error
      return data
    },
  })
}

export interface NewTransaction {
  accountId: string | null
  categoryId: string | null
  occurredOn: string
  amount: number
  description: string
  merchant?: string | null
  notes?: string | null
  documentId?: string | null
  lineItems?: { name: string; amount: number; qty?: number }[] | null
}

export function useCreateTransaction() {
  const { household, user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: NewTransaction) => {
      const { error } = await supabase.from('transactions').insert({
        household_id: household!.id,
        entered_by: user!.id,
        account_id: input.accountId,
        category_id: input.categoryId,
        document_id: input.documentId ?? null,
        occurred_on: input.occurredOn,
        amount: input.amount,
        description: input.description,
        merchant: input.merchant ?? null,
        notes: input.notes ?? null,
        line_items: input.lineItems ?? null,
        dedupe_hash: dedupeHash({
          accountId: input.accountId,
          occurredOn: input.occurredOn,
          amount: input.amount,
          description: input.description,
        }),
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions', household?.id] }),
  })
}

export function useUpdateTransaction() {
  const { household } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string } & Partial<NewTransaction>) => {
      const patch: Database['public']['Tables']['transactions']['Update'] = {}
      if (input.accountId !== undefined) patch.account_id = input.accountId
      if (input.categoryId !== undefined) patch.category_id = input.categoryId
      if (input.occurredOn !== undefined) patch.occurred_on = input.occurredOn
      if (input.amount !== undefined) patch.amount = input.amount
      if (input.description !== undefined) patch.description = input.description
      if (input.merchant !== undefined) patch.merchant = input.merchant
      if (input.notes !== undefined) patch.notes = input.notes
      if (input.lineItems !== undefined) patch.line_items = input.lineItems

      const { error } = await supabase.from('transactions').update(patch).eq('id', input.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions', household?.id] }),
  })
}

export function useDeleteTransaction() {
  const { household } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('transactions').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions', household?.id] }),
  })
}

// ---------------------------------------------------------------------------
// Budgets & income targets
// ---------------------------------------------------------------------------

export function useBudgets(month: string) {
  const { household } = useAuth()
  return useQuery({
    queryKey: ['budgets', household?.id, month],
    enabled: !!household,
    queryFn: async (): Promise<BudgetRow[]> => {
      const { data, error } = await supabase
        .from('budgets')
        .select('*')
        .eq('household_id', household!.id)
        .eq('month', month)
      if (error) throw error
      return data
    },
  })
}

export function useSetBudget() {
  const { household } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { month: string; categoryId: string; amount: number }) => {
      const { error } = await supabase
        .from('budgets')
        .upsert(
          { household_id: household!.id, month: input.month, category_id: input.categoryId, amount: input.amount },
          { onConflict: 'household_id,month,category_id' },
        )
      if (error) throw error
    },
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ['budgets', household?.id, vars.month] }),
  })
}

export function useCopyBudgetsFromPreviousMonth() {
  const { household } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { fromMonth: string; toMonth: string }) => {
      const { data: previous, error: fetchError } = await supabase
        .from('budgets')
        .select('category_id, amount')
        .eq('household_id', household!.id)
        .eq('month', input.fromMonth)
      if (fetchError) throw fetchError
      if (!previous.length) return

      const rows = previous.map((b) => ({
        household_id: household!.id,
        month: input.toMonth,
        category_id: b.category_id,
        amount: b.amount,
      }))
      const { error } = await supabase.from('budgets').upsert(rows, { onConflict: 'household_id,month,category_id' })
      if (error) throw error
    },
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ['budgets', household?.id, vars.toMonth] }),
  })
}

export function useIncomeTarget(month: string) {
  const { household } = useAuth()
  return useQuery({
    queryKey: ['income-target', household?.id, month],
    enabled: !!household,
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase
        .from('income_targets')
        .select('expected_income')
        .eq('household_id', household!.id)
        .eq('month', month)
        .maybeSingle()
      if (error) throw error
      return data?.expected_income ?? 0
    },
  })
}

export function useSetIncomeTarget() {
  const { household } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { month: string; amount: number }) => {
      const { error } = await supabase
        .from('income_targets')
        .upsert(
          { household_id: household!.id, month: input.month, expected_income: input.amount },
          { onConflict: 'household_id,month' },
        )
      if (error) throw error
    },
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ['income-target', household?.id, vars.month] }),
  })
}

// ---------------------------------------------------------------------------
// Recurring items (forecast inputs)
// ---------------------------------------------------------------------------

export function useRecurringItems() {
  const { household } = useAuth()
  return useQuery({
    queryKey: ['recurring-items', household?.id],
    enabled: !!household,
    queryFn: async (): Promise<RecurringRow[]> => {
      const { data, error } = await supabase
        .from('recurring_items')
        .select('*')
        .eq('household_id', household!.id)
        .order('name')
      if (error) throw error
      return data
    },
  })
}

export function useUpsertRecurringItem() {
  const { household } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      id?: string
      name: string
      categoryId: string | null
      amount: number
      frequency: RecurringFrequency
      startDate: string
      endDate: string | null
    }) => {
      const { error } = await supabase.from('recurring_items').upsert({
        id: input.id,
        household_id: household!.id,
        name: input.name,
        category_id: input.categoryId,
        amount: input.amount,
        frequency: input.frequency,
        start_date: input.startDate,
        end_date: input.endDate,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recurring-items', household?.id] }),
  })
}

export function useDeleteRecurringItem() {
  const { household } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('recurring_items').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recurring-items', household?.id] }),
  })
}

// ---------------------------------------------------------------------------
// Documents (uploads)
// ---------------------------------------------------------------------------

export function useDocuments() {
  const { household } = useAuth()
  return useQuery({
    queryKey: ['documents', household?.id],
    enabled: !!household,
    queryFn: async (): Promise<DocumentRow[]> => {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('household_id', household!.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useDocument(id: string | undefined) {
  const { household } = useAuth()
  return useQuery({
    queryKey: ['document', id],
    enabled: !!household && !!id,
    queryFn: async (): Promise<DocumentRow> => {
      const { data, error } = await supabase.from('documents').select('*').eq('id', id!).single()
      if (error) throw error
      return data
    },
  })
}

export function useConfirmDocument() {
  const { household } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('documents').update({ status: 'confirmed' }).eq('id', id)
      if (error) throw error
    },
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['document', id] })
      qc.invalidateQueries({ queryKey: ['documents', household?.id] })
    },
  })
}

export function useMerchantRules() {
  const { household } = useAuth()
  return useQuery({
    queryKey: ['merchant-rules', household?.id],
    enabled: !!household,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('merchant_rules')
        .select('*')
        .eq('household_id', household!.id)
      if (error) throw error
      return data
    },
  })
}

export function useUpsertMerchantRule() {
  const { household } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { merchantPattern: string; categoryId: string }) => {
      const { error } = await supabase
        .from('merchant_rules')
        .upsert(
          { household_id: household!.id, merchant_pattern: input.merchantPattern, category_id: input.categoryId },
          { onConflict: 'household_id,merchant_pattern' },
        )
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['merchant-rules', household?.id] }),
  })
}

export function useDeleteDocument() {
  const { household } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; storagePath: string }) => {
      await supabase.storage.from('documents').remove([input.storagePath])
      const { error } = await supabase.from('documents').delete().eq('id', input.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents', household?.id] }),
  })
}
