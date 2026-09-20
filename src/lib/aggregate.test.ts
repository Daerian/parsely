import { describe, expect, it } from 'vitest'
import { groupByMonth, groupByPerson, sumSpendByCategory, topMerchants, totalIncome, totalSpend } from './aggregate'
import type { TxLike } from './aggregate'

const txs: TxLike[] = [
  { amount: -50, category_id: 'groceries', occurred_on: '2026-01-05', merchant: 'Trader Joes', description: 'Trader Joes', entered_by: 'u1' },
  { amount: -20, category_id: 'groceries', occurred_on: '2026-01-10', merchant: 'Trader Joes', description: 'Trader Joes', entered_by: 'u2' },
  { amount: -15, category_id: 'dining', occurred_on: '2026-01-12', merchant: 'Cafe', description: 'Cafe', entered_by: 'u1' },
  { amount: 3000, category_id: 'income', occurred_on: '2026-01-01', merchant: null, description: 'Paycheck', entered_by: 'u1' },
  { amount: -30, category_id: 'groceries', occurred_on: '2026-02-01', merchant: 'Trader Joes', description: 'Trader Joes', entered_by: 'u2' },
]

describe('sumSpendByCategory', () => {
  it('sums spend per category and excludes income', () => {
    const totals = sumSpendByCategory(txs)
    const groceries = totals.find((t) => t.categoryId === 'groceries')
    const dining = totals.find((t) => t.categoryId === 'dining')
    expect(groceries?.total).toBe(100)
    expect(dining?.total).toBe(15)
    expect(totals.find((t) => t.categoryId === 'income')).toBeUndefined()
  })
})

describe('totalSpend / totalIncome', () => {
  it('computes totals across all transactions', () => {
    expect(totalSpend(txs)).toBe(115)
    expect(totalIncome(txs)).toBe(3000)
  })
})

describe('groupByMonth', () => {
  it('buckets by month and sorts ascending', () => {
    const months = groupByMonth(txs)
    expect(months.map((m) => m.month)).toEqual(['2026-01', '2026-02'])
    expect(months[0].spend).toBe(85)
    expect(months[0].income).toBe(3000)
    expect(months[1].spend).toBe(30)
  })
})

describe('topMerchants', () => {
  it('aggregates spend by merchant, sorted descending', () => {
    const merchants = topMerchants(txs)
    expect(merchants[0]).toMatchObject({ merchant: 'Trader Joes', total: 100, count: 3 })
    expect(merchants[1]).toMatchObject({ merchant: 'Cafe', total: 15, count: 1 })
  })

  it('respects the limit', () => {
    expect(topMerchants(txs, 1)).toHaveLength(1)
  })
})

describe('groupByPerson', () => {
  it('splits spend and income per person', () => {
    const byPerson = groupByPerson(txs)
    const u1 = byPerson.find((p) => p.personId === 'u1')!
    const u2 = byPerson.find((p) => p.personId === 'u2')!
    expect(u1.spend).toBe(65)
    expect(u1.income).toBe(3000)
    expect(u2.spend).toBe(50)
  })
})
