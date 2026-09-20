import type { RecurringFrequency } from './database.types'

export interface RecurringItemInput {
  id: string
  name: string
  categoryId: string | null
  amount: number // negative = spend, positive = income
  frequency: RecurringFrequency
  startDate: string // YYYY-MM-DD
  endDate: string | null
}

export interface RecurringOccurrence {
  itemId: string
  name: string
  categoryId: string | null
  amount: number
  date: string // YYYY-MM-DD
}

/**
 * Expands recurring items into individual dated occurrences within
 * [rangeStart, rangeEnd] (inclusive), for display on the forecast screen and
 * for summing into projected totals.
 */
export function expandRecurringItems(
  items: RecurringItemInput[],
  rangeStart: string,
  rangeEnd: string,
): RecurringOccurrence[] {
  const start = toUtcDate(rangeStart)
  const end = toUtcDate(rangeEnd)
  const occurrences: RecurringOccurrence[] = []

  for (const item of items) {
    const itemStart = toUtcDate(item.startDate)
    const itemEnd = item.endDate ? toUtcDate(item.endDate) : null
    const stepDays = FREQUENCY_STEP_DAYS[item.frequency]

    let cursor = new Date(itemStart)
    // Fast-forward to the first occurrence on/after rangeStart without an
    // unbounded loop for long-running items.
    if (cursor < start) {
      const elapsedMs = start.getTime() - cursor.getTime()
      const steps = Math.floor(elapsedMs / (stepDays * 86_400_000))
      cursor = addDays(cursor, steps * stepDays)
      while (cursor < start) cursor = addDays(cursor, stepDays)
    }

    while (cursor <= end && (!itemEnd || cursor <= itemEnd)) {
      occurrences.push({
        itemId: item.id,
        name: item.name,
        categoryId: item.categoryId,
        amount: item.amount,
        date: toIsoDate(cursor),
      })
      cursor = addDays(cursor, stepDays)
    }
  }

  return occurrences.sort((a, b) => a.date.localeCompare(b.date))
}

const FREQUENCY_STEP_DAYS: Record<RecurringFrequency, number> = {
  weekly: 7,
  biweekly: 14,
  monthly: 30, // approximation; good enough for forecasting, not accounting
  yearly: 365,
}

/**
 * Straight-line run-rate projection for the current month: extrapolates
 * spend-so-far across the remaining days. Returns the projected month total
 * (same sign convention as the input, so pass absolute spend for a spend
 * forecast).
 */
export function projectRunRate(amountSoFar: number, dayOfMonth: number, daysInMonth: number): number {
  if (dayOfMonth <= 0) return 0
  return (amountSoFar / dayOfMonth) * daysInMonth
}

/**
 * Average of trailing monthly totals, used to forecast categories/months
 * with no recurring-item coverage and no current-month data yet.
 */
export function trailingAverage(monthlyTotals: number[]): number {
  if (monthlyTotals.length === 0) return 0
  return monthlyTotals.reduce((sum, v) => sum + v, 0) / monthlyTotals.length
}

function toUtcDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`)
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000)
}
