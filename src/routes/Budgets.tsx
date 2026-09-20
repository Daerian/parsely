import { useMemo, useState } from 'react'
import { Copy } from 'lucide-react'
import {
  useBudgets,
  useCategories,
  useCopyBudgetsFromPreviousMonth,
  useIncomeTarget,
  useSetBudget,
  useSetIncomeTarget,
  useTransactions,
} from '../lib/queries'
import { computeBudgetProgress, dateStringToMonth, monthToDateString, shiftMonth } from '../lib/budgets'
import { sumSpendByCategory, totalIncome } from '../lib/aggregate'
import { currentMonthStart, formatMoney } from '../lib/format'
import Card from '../components/Card'
import MonthNav from '../components/MonthNav'
import ProgressBar from '../components/ProgressBar'

export default function Budgets() {
  const [month, setMonth] = useState(currentMonthStart())
  const monthEnd = monthToDateString(shiftMonth(dateStringToMonth(month), 1))
  const previousMonth = monthToDateString(shiftMonth(dateStringToMonth(month), -1))

  const { data: categories = [] } = useCategories()
  const { data: budgets = [] } = useBudgets(month)
  const { data: transactions = [] } = useTransactions({ monthStart: month, monthEnd })
  const { data: incomeTarget = 0 } = useIncomeTarget(month)

  const setBudget = useSetBudget()
  const setIncomeTarget = useSetIncomeTarget()
  const copyFromPrevious = useCopyBudgetsFromPreviousMonth()

  const [incomeInput, setIncomeInput] = useState('')
  const [editingIncome, setEditingIncome] = useState(false)

  const budgetByCategory = new Map(budgets.map((b) => [b.category_id, b.amount]))
  const spendByCategory = useMemo(() => {
    const totals = sumSpendByCategory(transactions)
    return new Map(totals.map((t) => [t.categoryId, t.total]))
  }, [transactions])

  const actualIncome = useMemo(() => totalIncome(transactions), [transactions])
  const spendCategories = categories.filter((c) => !c.is_income)
  const totalBudgeted = spendCategories.reduce((sum, c) => sum + (budgetByCategory.get(c.id) ?? 0), 0)
  const totalSpentValue = [...spendByCategory.values()].reduce((sum, v) => sum + v, 0)
  const overallProgress = computeBudgetProgress(totalBudgeted, totalSpentValue)

  function commitBudget(categoryId: string, value: string) {
    const amount = Number(value)
    if (Number.isNaN(amount) || amount < 0) return
    setBudget.mutate({ month, categoryId, amount })
  }

  function commitIncome() {
    const amount = Number(incomeInput)
    if (!Number.isNaN(amount) && amount >= 0) setIncomeTarget.mutate({ month, amount })
    setEditingIncome(false)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <h1 className="text-xl font-bold text-stone-900">Budget</h1>
      <MonthNav month={month} onChange={setMonth} />

      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-stone-400">Expected income</p>
            {editingIncome ? (
              <input
                autoFocus
                type="number"
                step="0.01"
                defaultValue={incomeTarget || ''}
                onChange={(e) => setIncomeInput(e.target.value)}
                onBlur={commitIncome}
                onKeyDown={(e) => e.key === 'Enter' && commitIncome()}
                className="mt-1 w-32 rounded-lg border border-stone-300 px-2 py-1 text-base"
              />
            ) : (
              <button onClick={() => setEditingIncome(true)} className="text-lg font-bold text-stone-900">
                {formatMoney(incomeTarget)}
              </button>
            )}
          </div>
          <div className="text-right">
            <p className="text-xs font-medium uppercase tracking-wide text-stone-400">Actual so far</p>
            <p className="text-lg font-bold text-brand-700">{formatMoney(actualIncome)}</p>
          </div>
        </div>
        <div className="border-t border-stone-100 pt-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-stone-600">Total budgeted</span>
            <span className="text-stone-500">
              {formatMoney(totalSpentValue)} / {formatMoney(totalBudgeted)}
            </span>
          </div>
          <div className="mt-2">
            <ProgressBar percent={overallProgress.percentUsed} status={overallProgress.status} />
          </div>
        </div>
      </Card>

      <button
        onClick={() => copyFromPrevious.mutate({ fromMonth: previousMonth, toMonth: month })}
        disabled={copyFromPrevious.isPending || budgets.length > 0}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white py-2.5 text-sm font-medium text-stone-600 disabled:opacity-40"
      >
        <Copy size={14} /> Copy budget from last month
      </button>

      <section className="space-y-3">
        {spendCategories.map((category) => {
          const budgeted = budgetByCategory.get(category.id) ?? 0
          const spent = spendByCategory.get(category.id) ?? 0
          const progress = computeBudgetProgress(budgeted, spent)
          return (
            <Card key={category.id}>
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-sm font-medium text-stone-700">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: category.color }} />
                  {category.name}
                </span>
                <span className="text-sm text-stone-500">{formatMoney(spent)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-stone-400">Budget $</span>
                <input
                  type="number"
                  step="1"
                  min="0"
                  defaultValue={budgeted || ''}
                  placeholder="0"
                  onBlur={(e) => commitBudget(category.id, e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                  className="w-24 rounded-lg border border-stone-300 px-2 py-1 text-sm"
                />
              </div>
              {budgeted > 0 && (
                <div className="mt-2">
                  <ProgressBar percent={progress.percentUsed} status={progress.status} />
                </div>
              )}
            </Card>
          )
        })}
      </section>
    </div>
  )
}
