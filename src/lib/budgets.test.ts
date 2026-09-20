import { describe, expect, it } from 'vitest'
import { computeBudgetProgress, dateStringToMonth, monthToDateString, shiftMonth } from './budgets'

describe('computeBudgetProgress', () => {
  it('marks under-budget spend as under', () => {
    const p = computeBudgetProgress(500, 200)
    expect(p.status).toBe('under')
    expect(p.remaining).toBe(300)
    expect(p.percentUsed).toBe(40)
  })

  it('marks spend at/above 90% as near', () => {
    expect(computeBudgetProgress(100, 90).status).toBe('near')
    expect(computeBudgetProgress(100, 99).status).toBe('near')
  })

  it('marks spend at/above budget as over', () => {
    expect(computeBudgetProgress(100, 100).status).toBe('over')
    expect(computeBudgetProgress(100, 150).status).toBe('over')
  })

  it('handles a zero budget with zero spend as under', () => {
    const p = computeBudgetProgress(0, 0)
    expect(p.status).toBe('under')
    expect(p.percentUsed).toBe(0)
  })

  it('handles a zero budget with any spend as over', () => {
    expect(computeBudgetProgress(0, 10).status).toBe('over')
  })
})

describe('month helpers', () => {
  it('shifts forward across a year boundary', () => {
    expect(shiftMonth({ year: 2025, month: 12 }, 1)).toEqual({ year: 2026, month: 1 })
  })

  it('shifts backward across a year boundary', () => {
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 })
  })

  it('shifts by multiple months', () => {
    expect(shiftMonth({ year: 2026, month: 1 }, 13)).toEqual({ year: 2027, month: 2 })
  })

  it('round-trips through date-string conversion', () => {
    const month = { year: 2026, month: 3 }
    expect(dateStringToMonth(monthToDateString(month))).toEqual(month)
  })

  it('formats single-digit months with a leading zero', () => {
    expect(monthToDateString({ year: 2026, month: 3 })).toBe('2026-03-01')
  })
})
