import { useState } from 'react'
import { Copy, LogOut, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '../lib/auth'
import {
  useAccounts,
  useCategories,
  useDeleteCategory,
  useHouseholdMembers,
  useUpsertAccount,
  useUpsertCategory,
} from '../lib/queries'
import Card from '../components/Card'
import type { AccountType } from '../lib/database.types'

const PALETTE = ['#16a34a', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#0ea5e9', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#64748b']

export default function Settings() {
  const { household, user, signOut } = useAuth()
  const { data: members = [] } = useHouseholdMembers()
  const { data: categories = [] } = useCategories()
  const { data: accounts = [] } = useAccounts()

  const upsertCategory = useUpsertCategory()
  const deleteCategory = useDeleteCategory()
  const upsertAccount = useUpsertAccount()

  const [newCategoryName, setNewCategoryName] = useState('')
  const [newAccountName, setNewAccountName] = useState('')
  const [newAccountType, setNewAccountType] = useState<AccountType>('checking')
  const [copied, setCopied] = useState(false)

  function copyInviteCode() {
    if (!household) return
    navigator.clipboard.writeText(household.inviteCode).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  function addCategory(e: React.FormEvent) {
    e.preventDefault()
    if (!newCategoryName.trim()) return
    const color = PALETTE[categories.length % PALETTE.length]
    upsertCategory.mutate({ name: newCategoryName.trim(), color, icon: 'circle', isIncome: false })
    setNewCategoryName('')
  }

  function addAccount(e: React.FormEvent) {
    e.preventDefault()
    if (!newAccountName.trim()) return
    upsertAccount.mutate({ name: newAccountName.trim(), accountType: newAccountType })
    setNewAccountName('')
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <h1 className="text-xl font-bold text-stone-900">Settings</h1>

      <Card>
        <h2 className="mb-2 text-sm font-semibold text-stone-700">Household</h2>
        <p className="text-base font-medium text-stone-900">{household?.name}</p>
        <div className="mt-2 flex items-center gap-2">
          <span className="rounded-lg bg-stone-100 px-3 py-1.5 font-mono text-sm tracking-widest text-stone-700">
            {household?.inviteCode}
          </span>
          <button onClick={copyInviteCode} className="flex items-center gap-1 text-xs font-medium text-brand-700">
            <Copy size={14} /> {copied ? 'Copied!' : 'Copy invite code'}
          </button>
        </div>
        <p className="mt-1 text-xs text-stone-400">Share this code so your partner can join.</p>

        <ul className="mt-3 divide-y divide-stone-100 border-t border-stone-100 pt-2">
          {members.map((m) => (
            <li key={m.user_id} className="flex items-center justify-between py-1.5 text-sm">
              <span className="text-stone-700">{m.display_name}</span>
              {m.user_id === user?.id && <span className="text-xs text-stone-400">You</span>}
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h2 className="mb-2 text-sm font-semibold text-stone-700">Categories</h2>
        <ul className="mb-3 space-y-1">
          {categories.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-1 text-sm">
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                {c.name}
                {c.is_income && <span className="text-xs text-stone-400">(income)</span>}
              </span>
              <button onClick={() => deleteCategory.mutate(c.id)} className="text-stone-300 active:text-red-600">
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
        <form onSubmit={addCategory} className="flex gap-2">
          <input
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="New category"
            className="flex-1 rounded-lg border border-stone-300 px-3 py-1.5 text-sm"
          />
          <button type="submit" className="flex items-center gap-1 rounded-lg bg-stone-800 px-3 py-1.5 text-sm font-medium text-white">
            <Plus size={14} /> Add
          </button>
        </form>
      </Card>

      <Card>
        <h2 className="mb-2 text-sm font-semibold text-stone-700">Accounts</h2>
        <ul className="mb-3 space-y-1">
          {accounts.map((a) => (
            <li key={a.id} className="flex items-center justify-between py-1 text-sm text-stone-700">
              <span>{a.name}</span>
              <span className="text-xs capitalize text-stone-400">{a.account_type.replace('_', ' ')}</span>
            </li>
          ))}
          {accounts.length === 0 && <p className="text-sm text-stone-400">No accounts yet.</p>}
        </ul>
        <form onSubmit={addAccount} className="flex gap-2">
          <input
            value={newAccountName}
            onChange={(e) => setNewAccountName(e.target.value)}
            placeholder="New account"
            className="flex-1 rounded-lg border border-stone-300 px-3 py-1.5 text-sm"
          />
          <select value={newAccountType} onChange={(e) => setNewAccountType(e.target.value as AccountType)} className="rounded-lg border border-stone-300 px-2 py-1.5 text-sm">
            <option value="checking">Checking</option>
            <option value="savings">Savings</option>
            <option value="credit_card">Credit card</option>
            <option value="cash">Cash</option>
            <option value="other">Other</option>
          </select>
          <button type="submit" className="flex items-center gap-1 rounded-lg bg-stone-800 px-3 py-1.5 text-sm font-medium text-white">
            <Plus size={14} />
          </button>
        </form>
      </Card>

      <button onClick={() => signOut()} className="flex w-full items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white py-3 text-sm font-medium text-stone-600">
        <LogOut size={16} /> Sign out
      </button>
    </div>
  )
}
