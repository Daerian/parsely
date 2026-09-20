export interface TxLike {
  amount: number
  category_id: string | null
  occurred_on: string // YYYY-MM-DD
  merchant: string | null
  description: string
  entered_by: string
}

export interface CategoryTotal {
  categoryId: string | null
  total: number // positive = spend magnitude
}

/** Sums spend (negative amounts) per category. Income rows are excluded. */
export function sumSpendByCategory(transactions: TxLike[]): CategoryTotal[] {
  const totals = new Map<string | null, number>()
  for (const tx of transactions) {
    if (tx.amount >= 0) continue
    const key = tx.category_id
    totals.set(key, (totals.get(key) ?? 0) + Math.abs(tx.amount))
  }
  return [...totals.entries()].map(([categoryId, total]) => ({ categoryId, total }))
}

export function totalSpend(transactions: TxLike[]): number {
  return transactions.filter((t) => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0)
}

export function totalIncome(transactions: TxLike[]): number {
  return transactions.filter((t) => t.amount > 0).reduce((sum, t) => sum + t.amount, 0)
}

export interface MonthTotal {
  month: string // YYYY-MM
  spend: number
  income: number
}

/** Buckets transactions by their occurrence month for a trend view. */
export function groupByMonth(transactions: TxLike[]): MonthTotal[] {
  const buckets = new Map<string, MonthTotal>()
  for (const tx of transactions) {
    const month = tx.occurred_on.slice(0, 7)
    const bucket = buckets.get(month) ?? { month, spend: 0, income: 0 }
    if (tx.amount < 0) bucket.spend += Math.abs(tx.amount)
    else bucket.income += tx.amount
    buckets.set(month, bucket)
  }
  return [...buckets.values()].sort((a, b) => a.month.localeCompare(b.month))
}

export interface MerchantTotal {
  merchant: string
  total: number
  count: number
}

/** Top spend by merchant (falls back to description when merchant is unset). */
export function topMerchants(transactions: TxLike[], limit = 10): MerchantTotal[] {
  const totals = new Map<string, MerchantTotal>()
  for (const tx of transactions) {
    if (tx.amount >= 0) continue
    const key = (tx.merchant ?? tx.description).trim()
    const bucket = totals.get(key) ?? { merchant: key, total: 0, count: 0 }
    bucket.total += Math.abs(tx.amount)
    bucket.count += 1
    totals.set(key, bucket)
  }
  return [...totals.values()].sort((a, b) => b.total - a.total).slice(0, limit)
}

export interface PersonTotal {
  personId: string
  spend: number
  income: number
}

export function groupByPerson(transactions: TxLike[]): PersonTotal[] {
  const totals = new Map<string, PersonTotal>()
  for (const tx of transactions) {
    const bucket = totals.get(tx.entered_by) ?? { personId: tx.entered_by, spend: 0, income: 0 }
    if (tx.amount < 0) bucket.spend += Math.abs(tx.amount)
    else bucket.income += tx.amount
    totals.set(tx.entered_by, bucket)
  }
  return [...totals.values()]
}
