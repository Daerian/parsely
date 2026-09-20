import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useBudgets, useCategories, useIncomeTarget, useTransactions } from '../lib/queries'
import { computeBudgetProgress, dateStringToMonth, monthToDateString, shiftMonth } from '../lib/budgets'
import { sumSpendByCategory, totalIncome, totalSpend } from '../lib/aggregate'
import { currentMonthStart, formatMonthLabel, formatMoney } from '../lib/format'
import Card from '../components/Card'
import ProgressBar from '../components/ProgressBar'

export default function Dashboard() {
  const { household } = useAuth()
  const [month] = useState(currentMonthStart())
  const monthEnd = monthToDateString(shiftMonth(dateStringToMonth(month), 1))

  const { data: transactions = [] } = useTransactions({ monthStart: month, monthEnd })
  const { data: categories = [] } = useCategories()
  const { data: budgets = [] } = useBudgets(month)
  const { data: incomeTarget = 0 } = useIncomeTarget(month)

  const spend = useMemo(() => totalSpend(transactions), [transactions])
  const income = useMemo(() => totalIncome(transactions), [transactions])
  const categoryTotals = useMemo(() => sumSpendByCategory(transactions), [transactions])

  const categoryMap = new Map(categories.map((c) => [c.id, c]))
  const budgetMap = new Map(budgets.map((b) => [b.category_id, b.amount]))

  const topCategoryRows = categoryTotals
    .map((ct) => ({
      category: ct.categoryId ? categoryMap.get(ct.categoryId) : undefined,
      spend: ct.total,
      budget: ct.categoryId ? budgetMap.get(ct.categoryId) ?? 0 : 0,
    }))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 5)

  const recentTransactions = transactions.slice(0, 5)

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <header>
        <p className="text-sm text-stone-500">{household?.name}</p>
        <h1 className="text-xl font-bold text-stone-900">{formatMonthLabel(month)}</h1>
      </header>

      <Card className="space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-stone-400">Income</p>
            <p className="text-lg font-bold text-brand-700">{formatMoney(income)}</p>
            {incomeTarget > 0 && <p className="text-xs text-stone-400">of {formatMoney(incomeTarget)} expected</p>}
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-stone-400">Spend</p>
            <p className="text-lg font-bold text-stone-900">{formatMoney(spend)}</p>
          </div>
        </div>
        <div className="border-t border-stone-100 pt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-400">Net</p>
          <p className={`text-lg font-bold ${income - spend >= 0 ? 'text-brand-700' : 'text-red-600'}`}>
            {formatMoney(income - spend)}
          </p>
        </div>
      </Card>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-stone-700">Top categories</h2>
          <Link to="/budgets" className="text-xs font-medium text-brand-700">
            View budget →
          </Link>
        </div>
        {topCategoryRows.length === 0 ? (
          <Card className="text-sm text-stone-400">No spend recorded yet this month.</Card>
        ) : (
          <Card className="space-y-3">
            {topCategoryRows.map((row, i) => {
              const progress = computeBudgetProgress(row.budget, row.spend)
              return (
                <div key={row.category?.id ?? i}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 font-medium text-stone-700">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: row.category?.color ?? '#94a3b8' }} />
                      {row.category?.name ?? 'Uncategorized'}
                    </span>
                    <span className="text-stone-500">
                      {formatMoney(row.spend)}
                      {row.budget > 0 && <span className="text-stone-400"> / {formatMoney(row.budget)}</span>}
                    </span>
                  </div>
                  {row.budget > 0 && <ProgressBar percent={progress.percentUsed} status={progress.status} />}
                </div>
              )
            })}
          </Card>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-stone-700">Recent activity</h2>
          <Link to="/transactions" className="text-xs font-medium text-brand-700">
            See all →
          </Link>
        </div>
        {recentTransactions.length === 0 ? (
          <Card className="text-sm text-stone-400">
            No transactions yet.{' '}
            <Link to="/upload" className="font-medium text-brand-700">
              Upload a statement or receipt
            </Link>{' '}
            to get started.
          </Card>
        ) : (
          <Card className="divide-y divide-stone-100 p-0">
            {recentTransactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-stone-800">{tx.merchant ?? tx.description}</p>
                  <p className="text-xs text-stone-400">{tx.occurred_on}</p>
                </div>
                <span className={`shrink-0 text-sm font-semibold ${tx.amount < 0 ? 'text-stone-800' : 'text-brand-700'}`}>
                  {formatMoney(tx.amount)}
                </span>
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  )
}
