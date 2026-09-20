import { useMemo, useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import {
  useCategories,
  useDeleteRecurringItem,
  useRecurringItems,
  useTransactions,
  useUpsertRecurringItem,
} from '../lib/queries'
import { expandRecurringItems, projectRunRate, trailingAverage } from '../lib/forecast'
import { sumSpendByCategory, totalSpend } from '../lib/aggregate'
import { currentMonthStart, daysInMonth, formatMoney } from '../lib/format'
import { dateStringToMonth, monthToDateString, shiftMonth } from '../lib/budgets'
import Card from '../components/Card'
import type { RecurringFrequency } from '../lib/database.types'

export default function Forecast() {
  const month = currentMonthStart()
  const { year, month: monthNum } = dateStringToMonth(month)
  const today = new Date()
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === monthNum
  const dayOfMonth = isCurrentMonth ? today.getDate() : daysInMonth(month)
  const totalDays = daysInMonth(month)

  const monthEnd = monthToDateString(shiftMonth(dateStringToMonth(month), 1))
  const { data: categories = [] } = useCategories()
  const { data: currentMonthTx = [] } = useTransactions({ monthStart: month, monthEnd })
  const { data: recurringItems = [] } = useRecurringItems()

  // Trailing 3 months of history, for categories with no run-rate signal yet.
  const trailingStart = monthToDateString(shiftMonth(dateStringToMonth(month), -3))
  const { data: trailingTx = [] } = useTransactions({ monthStart: trailingStart, monthEnd: month })

  const deleteRecurring = useDeleteRecurringItem()
  const [showAdd, setShowAdd] = useState(false)

  const spendCategories = categories.filter((c) => !c.is_income)

  const currentSpendByCategory = useMemo(() => new Map(sumSpendByCategory(currentMonthTx).map((t) => [t.categoryId, t.total])), [currentMonthTx])

  const trailingAverageByCategory = useMemo(() => {
    const byMonth = new Map<string, Map<string | null, number>>()
    for (const tx of trailingTx) {
      if (tx.amount >= 0) continue
      const monthKey = tx.occurred_on.slice(0, 7)
      const inner = byMonth.get(monthKey) ?? new Map()
      inner.set(tx.category_id, (inner.get(tx.category_id) ?? 0) + Math.abs(tx.amount))
      byMonth.set(monthKey, inner)
    }
    const perCategory = new Map<string | null, number[]>()
    for (const inner of byMonth.values()) {
      for (const [categoryId, total] of inner) {
        perCategory.set(categoryId, [...(perCategory.get(categoryId) ?? []), total])
      }
    }
    const result = new Map<string | null, number>()
    for (const [categoryId, totals] of perCategory) result.set(categoryId, trailingAverage(totals))
    return result
  }, [trailingTx])

  const recurringOccurrences = useMemo(
    () => expandRecurringItems(
      recurringItems.map((r) => ({
        id: r.id,
        name: r.name,
        categoryId: r.category_id,
        amount: r.amount,
        frequency: r.frequency,
        startDate: r.start_date,
        endDate: r.end_date,
      })),
      month,
      monthEnd,
    ),
    [recurringItems, month, monthEnd],
  )

  const recurringByCategory = useMemo(() => {
    const totals = new Map<string | null, number>()
    for (const occ of recurringOccurrences) {
      if (occ.amount >= 0) continue
      totals.set(occ.categoryId, (totals.get(occ.categoryId) ?? 0) + Math.abs(occ.amount))
    }
    return totals
  }, [recurringOccurrences])

  const projectedRows = spendCategories.map((category) => {
    const soFar = currentSpendByCategory.get(category.id) ?? 0
    const runRate = projectRunRate(soFar, dayOfMonth, totalDays)
    const recurring = recurringByCategory.get(category.id) ?? 0
    const trailingAvg = trailingAverageByCategory.get(category.id) ?? 0
    // Blend: recurring commitments are known cash outflows, added on top of
    // whichever signal is stronger — this month's pace, or trailing history.
    const baseline = Math.max(runRate, trailingAvg)
    const projected = Math.max(baseline, recurring)
    return { category, soFar, projected }
  })

  const totalProjected = projectedRows.reduce((sum, r) => sum + r.projected, 0)
  const totalSoFar = totalSpend(currentMonthTx)

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <h1 className="text-xl font-bold text-stone-900">Forecast</h1>

      <Card className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-stone-400">Projected month-end spend</p>
        <p className="text-2xl font-bold text-stone-900">{formatMoney(totalProjected)}</p>
        <p className="text-xs text-stone-400">{formatMoney(totalSoFar)} spent so far, day {dayOfMonth} of {totalDays}</p>
      </Card>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-stone-700">By category</h2>
        {projectedRows.map(({ category, soFar, projected }) => (
          <Card key={category.id} className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm font-medium text-stone-700">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: category.color }} />
              {category.name}
            </span>
            <div className="text-right">
              <p className="text-sm font-semibold text-stone-800">{formatMoney(projected)}</p>
              <p className="text-xs text-stone-400">{formatMoney(soFar)} so far</p>
            </div>
          </Card>
        ))}
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-stone-700">Recurring items</h2>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-1 text-xs font-medium text-brand-700">
            <Plus size={14} /> Add
          </button>
        </div>
        {recurringItems.length === 0 ? (
          <Card className="text-sm text-stone-400">
            No recurring items yet. Add rent, subscriptions, or your paycheck to sharpen next month's forecast.
          </Card>
        ) : (
          <Card className="divide-y divide-stone-100 p-0">
            {recurringItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-stone-800">{item.name}</p>
                  <p className="text-xs text-stone-400">{item.frequency}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-semibold ${item.amount < 0 ? 'text-stone-800' : 'text-brand-700'}`}>
                    {formatMoney(item.amount)}
                  </span>
                  <button onClick={() => deleteRecurring.mutate(item.id)} className="text-stone-400 active:text-red-600">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </Card>
        )}
      </section>

      {showAdd && <RecurringItemModal onClose={() => setShowAdd(false)} />}
    </div>
  )
}

function RecurringItemModal({ onClose }: { onClose: () => void }) {
  const { data: categories = [] } = useCategories()
  const upsert = useUpsertRecurringItem()

  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [isSpend, setIsSpend] = useState(true)
  const [categoryId, setCategoryId] = useState('')
  const [frequency, setFrequency] = useState<RecurringFrequency>('monthly')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = Number(amount)
    if (!name.trim() || Number.isNaN(parsed) || parsed <= 0) {
      setError('Enter a name and a positive amount.')
      return
    }
    try {
      await upsert.mutateAsync({
        name,
        categoryId: categoryId || null,
        amount: isSpend ? -parsed : parsed,
        frequency,
        startDate: new Date().toISOString().slice(0, 10),
        endDate: null,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    }
  }

  return (
    <div className="fixed inset-0 z-10 flex items-end bg-black/30 sm:items-center sm:justify-center">
      <div className="safe-bottom w-full rounded-t-2xl bg-white p-4 sm:max-w-sm sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-stone-900">Add recurring item</h2>
          <button onClick={onClose} className="p-1 text-stone-400">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex rounded-xl bg-stone-100 p-1 text-sm font-medium">
            <button type="button" onClick={() => setIsSpend(true)} className={`flex-1 rounded-lg py-2 ${isSpend ? 'bg-white shadow-sm' : 'text-stone-500'}`}>
              Spend
            </button>
            <button type="button" onClick={() => setIsSpend(false)} className={`flex-1 rounded-lg py-2 ${!isSpend ? 'bg-white shadow-sm' : 'text-stone-500'}`}>
              Income
            </button>
          </div>
          <input placeholder="Name (e.g. Rent, Netflix)" value={name} onChange={(e) => setName(e.target.value)} required className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm" />
          <input type="number" step="0.01" min="0" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} required className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm" />
          <select value={frequency} onChange={(e) => setFrequency(e.target.value as RecurringFrequency)} className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm">
            <option value="weekly">Weekly</option>
            <option value="biweekly">Every 2 weeks</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm">
            <option value="">Uncategorized</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={upsert.isPending} className="w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white active:bg-brand-700 disabled:opacity-50">
            {upsert.isPending ? 'Saving…' : 'Save'}
          </button>
        </form>
      </div>
    </div>
  )
}
