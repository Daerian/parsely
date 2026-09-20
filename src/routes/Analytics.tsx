import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useAuth } from '../lib/auth'
import { useCategories, useHouseholdMembers, useTransactions } from '../lib/queries'
import { groupByMonth, groupByPerson, sumSpendByCategory, topMerchants } from '../lib/aggregate'
import { currentMonthStart, formatMoney } from '../lib/format'
import { dateStringToMonth, monthToDateString, shiftMonth } from '../lib/budgets'
import Card from '../components/Card'

const RANGE_MONTHS = 6

export default function Analytics() {
  const { household } = useAuth()
  const [rangeStart] = useState(() => monthToDateString(shiftMonth(dateStringToMonth(currentMonthStart()), -(RANGE_MONTHS - 1))))

  const { data: categories = [] } = useCategories()
  const { data: members = [] } = useHouseholdMembers()
  const { data: transactions = [] } = useTransactions({ monthStart: rangeStart })
  const memberNameById = new Map(members.map((m) => [m.user_id, m.display_name]))

  const categoryMap = new Map(categories.map((c) => [c.id, c]))

  const categoryTotals = useMemo(() => {
    return sumSpendByCategory(transactions)
      .map((t) => ({
        name: t.categoryId ? categoryMap.get(t.categoryId)?.name ?? 'Uncategorized' : 'Uncategorized',
        color: t.categoryId ? categoryMap.get(t.categoryId)?.color ?? '#94a3b8' : '#94a3b8',
        value: t.total,
      }))
      .sort((a, b) => b.value - a.value)
  }, [transactions, categories])

  const monthlyTotals = useMemo(() => groupByMonth(transactions), [transactions])
  const merchants = useMemo(() => topMerchants(transactions, 8), [transactions])
  const personTotals = useMemo(() => groupByPerson(transactions), [transactions])

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <h1 className="text-xl font-bold text-stone-900">Insights</h1>
      <p className="text-sm text-stone-500">Last {RANGE_MONTHS} months</p>

      <Card>
        <h2 className="mb-2 text-sm font-semibold text-stone-700">Spend by category</h2>
        {categoryTotals.length === 0 ? (
          <p className="text-sm text-stone-400">No spend in this range yet.</p>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={categoryTotals} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {categoryTotals.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatMoney(typeof v === "number" ? v : Number(v) || 0)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="mb-2 text-sm font-semibold text-stone-700">Month over month</h2>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyTotals}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5e4" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} width={40} tickFormatter={(v) => `$${v}`} />
              <Tooltip formatter={(v) => formatMoney(typeof v === "number" ? v : Number(v) || 0)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="income" name="Income" fill="#16a34a" radius={[4, 4, 0, 0]} />
              <Bar dataKey="spend" name="Spend" fill="#78716c" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <h2 className="mb-2 text-sm font-semibold text-stone-700">Top merchants</h2>
        {merchants.length === 0 ? (
          <p className="text-sm text-stone-400">No spend in this range yet.</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {merchants.map((m) => (
              <li key={m.merchant} className="flex items-center justify-between py-2 text-sm">
                <span className="text-stone-700">
                  {m.merchant} <span className="text-stone-400">({m.count})</span>
                </span>
                <span className="font-medium text-stone-800">{formatMoney(m.total)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {household && personTotals.length > 1 && (
        <Card>
          <h2 className="mb-2 text-sm font-semibold text-stone-700">Split by person</h2>
          <ul className="space-y-2">
            {personTotals.map((p) => (
              <li key={p.personId} className="flex items-center justify-between text-sm">
                <span className="text-stone-600">{memberNameById.get(p.personId) ?? 'Unknown'}</span>
                <span className="font-medium text-stone-800">{formatMoney(p.spend)} spent</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
