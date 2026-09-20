import { useMemo, useState } from 'react'
import { Plus, Search, Trash2, X } from 'lucide-react'
import {
  useAccounts,
  useCategories,
  useCreateTransaction,
  useDeleteTransaction,
  useTransactions,
  useUpdateTransaction,
} from '../lib/queries'
import { formatMoney } from '../lib/format'
import Card from '../components/Card'

export default function Transactions() {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const { data: categories = [] } = useCategories()
  const { data: transactions = [], isLoading } = useTransactions({
    search: search || undefined,
    categoryId: categoryFilter || undefined,
  })
  const deleteTransaction = useDeleteTransaction()
  const categoryMap = new Map(categories.map((c) => [c.id, c]))

  const grouped = useMemo(() => {
    const byMonth = new Map<string, typeof transactions>()
    for (const tx of transactions) {
      const key = tx.occurred_on.slice(0, 7)
      byMonth.set(key, [...(byMonth.get(key) ?? []), tx])
    }
    return [...byMonth.entries()]
  }, [transactions])

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-stone-900">Transactions</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1 rounded-full bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white active:bg-brand-700"
        >
          <Plus size={16} /> Add
        </button>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search merchant or description"
            className="w-full rounded-xl border border-stone-300 py-2 pl-9 pr-3 text-sm"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-xl border border-stone-300 px-2 py-2 text-sm"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {isLoading && <p className="text-sm text-stone-400">Loading…</p>}

      {!isLoading && transactions.length === 0 && (
        <Card className="text-sm text-stone-400">No transactions match.</Card>
      )}

      {grouped.map(([month, txs]) => (
        <section key={month}>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">{month}</h2>
          <Card className="divide-y divide-stone-100 p-0">
            {txs.map((tx) => (
              <button
                key={tx.id}
                onClick={() => setEditingId(tx.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-stone-50"
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: tx.category_id ? categoryMap.get(tx.category_id)?.color ?? '#94a3b8' : '#e7e5e4' }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-stone-800">{tx.merchant ?? tx.description}</p>
                  <p className="text-xs text-stone-400">
                    {tx.occurred_on} · {tx.category_id ? categoryMap.get(tx.category_id)?.name ?? 'Uncategorized' : 'Uncategorized'}
                  </p>
                </div>
                <span className={`shrink-0 text-sm font-semibold ${tx.amount < 0 ? 'text-stone-800' : 'text-brand-700'}`}>
                  {formatMoney(tx.amount)}
                </span>
              </button>
            ))}
          </Card>
        </section>
      ))}

      {showAdd && <TransactionModal onClose={() => setShowAdd(false)} />}
      {editingId && (
        <TransactionModal
          transaction={transactions.find((t) => t.id === editingId)}
          onClose={() => setEditingId(null)}
          onDelete={() => {
            deleteTransaction.mutate(editingId)
            setEditingId(null)
          }}
        />
      )}
    </div>
  )
}

interface TransactionModalProps {
  transaction?: {
    id: string
    occurred_on: string
    amount: number
    description: string
    merchant: string | null
    category_id: string | null
    account_id: string | null
    notes: string | null
  }
  onClose: () => void
  onDelete?: () => void
}

function TransactionModal({ transaction, onClose, onDelete }: TransactionModalProps) {
  const { data: categories = [] } = useCategories()
  const { data: accounts = [] } = useAccounts()
  const createTransaction = useCreateTransaction()
  const updateTransaction = useUpdateTransaction()

  const [date, setDate] = useState(transaction?.occurred_on ?? new Date().toISOString().slice(0, 10))
  const [description, setDescription] = useState(transaction?.description ?? '')
  const [amount, setAmount] = useState(transaction ? Math.abs(transaction.amount).toString() : '')
  const [isSpend, setIsSpend] = useState(transaction ? transaction.amount < 0 : true)
  const [categoryId, setCategoryId] = useState(transaction?.category_id ?? '')
  const [accountId, setAccountId] = useState(transaction?.account_id ?? '')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const parsedAmount = Number(amount)
    if (!description.trim() || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Enter a description and a positive amount.')
      return
    }
    const signedAmount = isSpend ? -parsedAmount : parsedAmount
    try {
      if (transaction) {
        await updateTransaction.mutateAsync({
          id: transaction.id,
          occurredOn: date,
          description,
          amount: signedAmount,
          categoryId: categoryId || null,
          accountId: accountId || null,
        })
      } else {
        await createTransaction.mutateAsync({
          occurredOn: date,
          description,
          merchant: description,
          amount: signedAmount,
          categoryId: categoryId || null,
          accountId: accountId || null,
        })
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    }
  }

  const saving = createTransaction.isPending || updateTransaction.isPending

  return (
    <div className="fixed inset-0 z-10 flex items-end bg-black/30 sm:items-center sm:justify-center">
      <div className="safe-bottom max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 sm:max-w-sm sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-stone-900">{transaction ? 'Edit transaction' : 'Add transaction'}</h2>
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

          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm" />
          <input
            placeholder="Description / merchant"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
          />
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
          />
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm">
            <option value="">Uncategorized</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {accounts.length > 0 && (
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm">
              <option value="">No account</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button type="submit" disabled={saving} className="w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white active:bg-brand-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>

          {onDelete && (
            <button type="button" onClick={onDelete} className="flex w-full items-center justify-center gap-1 py-2 text-sm font-medium text-red-600">
              <Trash2 size={14} /> Delete transaction
            </button>
          )}
        </form>
      </div>
    </div>
  )
}
