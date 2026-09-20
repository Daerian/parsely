import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'
import {
  useAccounts,
  useCategories,
  useConfirmDocument,
  useCreateTransaction,
  useDocument,
  useMerchantRules,
  useTransactions,
  useUpsertMerchantRule,
} from '../lib/queries'
import { dedupeHash } from '../lib/dedupe'
import { findMatch } from '../lib/matching'
import { matchMerchantRule, toMerchantPattern } from '../lib/merchantRules'
import { formatMoney } from '../lib/format'
import type { LineItem } from '../lib/database.types'

interface ParsedTx {
  date: string
  amount: number
  description: string
  merchant: string | null
  suggested_category: string | null
  line_items: LineItem[] | null
}

interface ReviewRow extends ParsedTx {
  key: string
  include: boolean
  categoryId: string | null
  accountId: string | null
  isDuplicate: boolean
  matchedTransactionId: string | null
}

export default function Review() {
  const { documentId } = useParams<{ documentId: string }>()
  const navigate = useNavigate()

  const { data: document, isLoading: docLoading } = useDocument(documentId)
  const { data: categories = [] } = useCategories()
  const { data: accounts = [] } = useAccounts()
  const { data: merchantRules = [] } = useMerchantRules()
  const { data: existingTransactions = [] } = useTransactions({
    monthStart: sixMonthsAgo(),
  })

  const createTransaction = useCreateTransaction()
  const confirmDocument = useConfirmDocument()
  const upsertMerchantRule = useUpsertMerchantRule()

  const categoryByName = useMemo(() => new Map(categories.map((c) => [c.name.toLowerCase(), c])), [categories])
  const rules = useMemo(
    () => merchantRules.map((r) => ({ merchantPattern: r.merchant_pattern, categoryId: r.category_id })),
    [merchantRules],
  )

  const parsedTransactions: ParsedTx[] = (document?.parse_result as { transactions?: ParsedTx[] } | null)
    ?.transactions ?? []

  const [rows, setRows] = useState<ReviewRow[] | null>(null)
  const [defaultAccountId, setDefaultAccountId] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  // Build editable rows once, when both the document and reference data have loaded.
  if (rows === null && document?.status === 'parsed' && parsedTransactions.length > 0 && categories.length >= 0) {
    const built = parsedTransactions.map((tx, i): ReviewRow => {
      const dupHash = dedupeHash({
        accountId: defaultAccountId || null,
        occurredOn: tx.date,
        amount: tx.amount,
        description: tx.description,
      })
      const isDuplicate = existingTransactions.some((t) => t.dedupe_hash === dupHash)
      const match = findMatch(
        { occurredOn: tx.date, amount: tx.amount },
        existingTransactions.map((t) => ({ id: t.id, occurredOn: t.occurred_on, amount: t.amount })),
      )
      const ruleCategoryId = matchMerchantRule(rules, tx.merchant ?? tx.description)
      const suggestedCategoryId = tx.suggested_category ? categoryByName.get(tx.suggested_category.toLowerCase())?.id : undefined

      return {
        ...tx,
        key: `${i}`,
        include: !isDuplicate,
        categoryId: ruleCategoryId ?? suggestedCategoryId ?? null,
        accountId: defaultAccountId || null,
        isDuplicate,
        matchedTransactionId: match?.id ?? null,
      }
    })
    setRows(built)
  }

  if (docLoading || !document) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-stone-400">
        <Loader2 className="animate-spin" />
      </div>
    )
  }

  if (document.status === 'parsing' || document.status === 'pending') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-8 text-center text-stone-500">
        <Loader2 className="animate-spin" size={28} />
        <p>Reading your document with AI…</p>
      </div>
    )
  }

  if (document.status === 'error') {
    return (
      <div className="p-4">
        <BackLink navigate={navigate} />
        <p className="mt-4 text-sm text-red-600">Parsing failed: {document.error_message}</p>
      </div>
    )
  }

  if (parsedTransactions.length === 0) {
    return (
      <div className="p-4">
        <BackLink navigate={navigate} />
        <p className="mt-4 text-sm text-stone-500">No transactions were found in this document.</p>
      </div>
    )
  }

  const displayRows = rows ?? []
  const includedCount = displayRows.filter((r) => r.include).length

  function updateRow(key: string, patch: Partial<ReviewRow>) {
    setRows((prev) => prev!.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  async function handleConfirm() {
    if (!displayRows.length) return
    setError(null)
    try {
      for (const row of displayRows) {
        if (!row.include) continue

        await createTransaction.mutateAsync({
          accountId: row.accountId,
          categoryId: row.categoryId,
          occurredOn: row.date,
          amount: row.amount,
          description: row.description,
          merchant: row.merchant,
          documentId,
          lineItems: row.line_items,
        })

        // Learn from a manual correction: if the user picked a different
        // category than the AI suggested, remember it for next time.
        const suggestedId = row.suggested_category ? categoryByName.get(row.suggested_category.toLowerCase())?.id : null
        if (row.categoryId && row.categoryId !== suggestedId && (row.merchant || row.description)) {
          await upsertMerchantRule.mutateAsync({
            merchantPattern: toMerchantPattern(row.merchant ?? row.description),
            categoryId: row.categoryId,
          })
        }
      }
      await confirmDocument.mutateAsync(documentId!)
      navigate('/transactions')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save transactions')
    }
  }

  const saving = createTransaction.isPending || confirmDocument.isPending

  return (
    <div className="mx-auto max-w-2xl p-4 pb-28">
      <BackLink navigate={navigate} />
      <h1 className="mt-2 text-xl font-bold text-stone-900">Review {document.kind}</h1>
      <p className="mb-4 text-sm text-stone-500">
        {includedCount} of {displayRows.length} transaction{displayRows.length === 1 ? '' : 's'} selected
      </p>

      {accounts.length > 0 && (
        <div className="mb-4">
          <label className="mb-1 block text-xs font-medium text-stone-500">Apply to account</label>
          <select
            value={defaultAccountId}
            onChange={(e) => {
              setDefaultAccountId(e.target.value)
              setRows((prev) => prev?.map((r) => ({ ...r, accountId: e.target.value || null })) ?? null)
            }}
            className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
          >
            <option value="">No account</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-3">
        {displayRows.map((row) => (
          <div key={row.key} className={`rounded-2xl border p-3 ${row.include ? 'border-stone-200 bg-white' : 'border-stone-100 bg-stone-50 opacity-60'}`}>
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={row.include}
                onChange={(e) => updateRow(row.key, { include: e.target.checked })}
                className="mt-1 h-4 w-4 shrink-0 rounded border-stone-300"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium text-stone-800">{row.merchant ?? row.description}</p>
                  <span className={`shrink-0 text-sm font-semibold ${row.amount < 0 ? 'text-stone-800' : 'text-brand-700'}`}>
                    {formatMoney(row.amount)}
                  </span>
                </div>
                <p className="text-xs text-stone-400">{row.date}</p>

                {row.isDuplicate && (
                  <p className="mt-1 text-xs font-medium text-amber-600">Looks like a duplicate of an existing transaction — unchecked by default.</p>
                )}
                {row.matchedTransactionId && !row.isDuplicate && (
                  <p className="mt-1 text-xs font-medium text-blue-600">Matches an existing transaction by amount/date.</p>
                )}

                {row.line_items && row.line_items.length > 0 && (
                  <ul className="mt-1 space-y-0.5 text-xs text-stone-400">
                    {row.line_items.map((li, i) => (
                      <li key={i}>
                        {li.name} — {formatMoney(li.amount)}
                      </li>
                    ))}
                  </ul>
                )}

                <select
                  value={row.categoryId ?? ''}
                  onChange={(e) => updateRow(row.key, { categoryId: e.target.value || null })}
                  className="mt-2 w-full rounded-lg border border-stone-300 px-2 py-1.5 text-sm"
                >
                  <option value="">Uncategorized</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        ))}
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="safe-bottom fixed inset-x-0 bottom-16 border-t border-stone-200 bg-white p-3">
        <div className="mx-auto max-w-2xl">
          <button
            onClick={handleConfirm}
            disabled={saving || includedCount === 0}
            className="w-full rounded-xl bg-brand-600 px-4 py-3 text-base font-semibold text-white active:bg-brand-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : `Add ${includedCount} transaction${includedCount === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </div>
  )
}

function BackLink({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  return (
    <button onClick={() => navigate('/upload')} className="flex items-center gap-1 text-sm text-stone-500">
      <ArrowLeft size={16} /> Back to uploads
    </button>
  )
}

function sixMonthsAgo(): string {
  const now = new Date()
  now.setMonth(now.getMonth() - 6)
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}
