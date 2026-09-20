import { describe, expect, it } from 'vitest'
import { expandRecurringItems, projectRunRate, trailingAverage } from './forecast'

describe('expandRecurringItems', () => {
  it('expands a monthly item across a multi-month range', () => {
    const occurrences = expandRecurringItems(
      [
        {
          id: 'rent',
          name: 'Rent',
          categoryId: 'housing',
          amount: -2000,
          frequency: 'monthly',
          startDate: '2026-01-01',
          endDate: null,
        },
      ],
      '2026-01-01',
      '2026-03-31',
    )
    expect(occurrences.length).toBeGreaterThanOrEqual(3)
    expect(occurrences.every((o) => o.itemId === 'rent' && o.amount === -2000)).toBe(true)
  })

  it('respects the item start date (no occurrences before it)', () => {
    const occurrences = expandRecurringItems(
      [
        {
          id: 'gym',
          name: 'Gym',
          categoryId: null,
          amount: -30,
          frequency: 'monthly',
          startDate: '2026-06-01',
          endDate: null,
        },
      ],
      '2026-01-01',
      '2026-12-31',
    )
    expect(occurrences.every((o) => o.date >= '2026-06-01')).toBe(true)
  })

  it('respects the item end date', () => {
    const occurrences = expandRecurringItems(
      [
        {
          id: 'trial',
          name: 'Trial subscription',
          categoryId: null,
          amount: -10,
          frequency: 'weekly',
          startDate: '2026-01-01',
          endDate: '2026-01-15',
        },
      ],
      '2026-01-01',
      '2026-03-01',
    )
    expect(occurrences.every((o) => o.date <= '2026-01-15')).toBe(true)
    expect(occurrences.length).toBeGreaterThan(0)
  })

  it('returns nothing when the range is entirely before the item starts', () => {
    const occurrences = expandRecurringItems(
      [
        {
          id: 'future',
          name: 'Future thing',
          categoryId: null,
          amount: -5,
          frequency: 'weekly',
          startDate: '2027-01-01',
          endDate: null,
        },
      ],
      '2026-01-01',
      '2026-12-31',
    )
    expect(occurrences).toHaveLength(0)
  })
})

describe('projectRunRate', () => {
  it('extrapolates linearly across the month', () => {
    expect(projectRunRate(500, 10, 30)).toBe(1500)
  })

  it('returns 0 when no days have elapsed', () => {
    expect(projectRunRate(0, 0, 30)).toBe(0)
  })
})

describe('trailingAverage', () => {
  it('averages a list of totals', () => {
    expect(trailingAverage([100, 200, 300])).toBe(200)
  })

  it('returns 0 for an empty list', () => {
    expect(trailingAverage([])).toBe(0)
  })
})
