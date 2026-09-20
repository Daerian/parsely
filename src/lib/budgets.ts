export type BudgetStatus = 'under' | 'near' | 'over'

export interface BudgetProgress {
  budgeted: number
  actual: number
  remaining: number
  percentUsed: number // 0-100+, Infinity clamped to a large number when budgeted is 0
  status: BudgetStatus
}

const NEAR_THRESHOLD_PERCENT = 90

/**
 * Compares actual spend (as a positive number) against a category's budget
 * for a month. Both status thresholds are on percent-used: >=100% is over,
 * >=90% is near, else under.
 */
export function computeBudgetProgress(budgeted: number, actualSpend: number): BudgetProgress {
  const percentUsed = budgeted > 0 ? (actualSpend / budgeted) * 100 : actualSpend > 0 ? Infinity : 0
  const status: BudgetStatus = percentUsed >= 100 ? 'over' : percentUsed >= NEAR_THRESHOLD_PERCENT ? 'near' : 'under'
  return {
    budgeted,
    actual: actualSpend,
    remaining: budgeted - actualSpend,
    percentUsed,
    status,
  }
}

export interface MonthKey {
  year: number
  month: number // 1-12
}

export function shiftMonth({ year, month }: MonthKey, delta: number): MonthKey {
  const zeroBased = month - 1 + delta
  const newYear = year + Math.floor(zeroBased / 12)
  const newMonth = ((zeroBased % 12) + 12) % 12
  return { year: newYear, month: newMonth + 1 }
}

export function monthToDateString({ year, month }: MonthKey): string {
  return `${year}-${String(month).padStart(2, '0')}-01`
}

export function dateStringToMonth(iso: string): MonthKey {
  const [year, month] = iso.split('-').map(Number)
  return { year, month }
}
