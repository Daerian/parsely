import { useState } from 'react'
import { Check, Copy, LogOut, Pencil, Plus, Share2, Trash2, X } from 'lucide-react'
import { useAuth } from '../lib/auth'
import {
  useAccounts,
  useCategories,
  useDeleteCategory,
  useHouseholdMembers,
  useUpdateDisplayName,
  useUpsertAccount,
  useUpsertCategory,
} from '../lib/queries'
import Card from '../components/Card'
import { getErrorMessage } from '../lib/errors'
import type { AccountType } from '../lib/database.types'

const PALETTE = ['#16a34a', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#0ea5e9', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#64748b']

export default function Settings() {
  const { household, user, signOut, refreshHousehold } = useAuth()
  const { data: members = [] } = useHouseholdMembers()
  const { data: categories = [] } = useCategories()
  const { data: accounts = [] } = useAccounts()

  const upsertCategory = useUpsertCategory()
  const deleteCategory = useDeleteCategory()
  const upsertAccount = useUpsertAccount()
  const updateDisplayName = useUpdateDisplayName()

  const [newCategoryName, setNewCategoryName] = useState('')
  const [newAccountName, setNewAccountName] = useState('')
  const [newAccountType, setNewAccountType] = useState<AccountType>('checking')
  const [copied, setCopied] = useState(false)
  const [shareNote, setShareNote] = useState<string | null>(null)
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)

  const inviteMessage = household
    ? `Join our household "${household.name}" on Parsely. Invite code: ${household.inviteCode}`
    : ''

  function copyInviteCode() {
    if (!household) return
    navigator.clipboard.writeText(household.inviteCode).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  /**
   * Uses the native share sheet where it exists (phones), which is the whole
   * point here — the invite needs to get into a text message. Desktop
   * browsers mostly lack it, so fall back to copying the full message.
   */
  async function shareInvite() {
    if (!household) return
    setShareNote(null)
    const url = window.location.origin

    if (navigator.share) {
      try {
        await navigator.share({ title: 'Join my Parsely household', text: inviteMessage, url })
        return
      } catch (err) {
        // Dismissing the share sheet throws AbortError; that's a normal
        // cancel, not something to report or fall back from.
        if (err instanceof Error && err.name === 'AbortError') return
      }
    }

    try {
      await navigator.clipboard.writeText(`${inviteMessage}\n${url}`)
      setShareNote('Invite message copied to clipboard')
      setTimeout(() => setShareNote(null), 2500)
    } catch {
      setShareNote('Could not share automatically — copy the code above manually.')
    }
  }

  function startEditingName() {
    setNameDraft(household?.displayName ?? '')
    setNameError(null)
    setEditingName(true)
  }

  async function saveDisplayName(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = nameDraft.trim()
    if (!trimmed) {
      setNameError('Name cannot be empty.')
      return
    }
    if (trimmed === household?.displayName) {
      setEditingName(false)
      return
    }
    setNameError(null)
    try {
      await updateDisplayName.mutateAsync(trimmed)
      await refreshHousehold()
      setEditingName(false)
    } catch (err) {
      setNameError(getErrorMessage(err, 'Could not save your name'))
    }
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
        <h2 className="mb-2 text-sm font-semibold text-stone-700">Your profile</h2>
        {editingName ? (
          <form onSubmit={saveDisplayName} className="flex items-center gap-2">
            <input
              id="display-name"
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              placeholder="Your name"
              maxLength={60}
              className="min-w-0 flex-1 rounded-lg border border-stone-300 px-3 py-1.5 text-sm"
            />
            <button
              type="submit"
              disabled={updateDisplayName.isPending}
              aria-label="Save name"
              className="flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white active:bg-brand-700 disabled:opacity-50"
            >
              <Check size={14} /> Save
            </button>
            <button
              type="button"
              onClick={() => setEditingName(false)}
              aria-label="Cancel"
              className="rounded-lg p-1.5 text-stone-400 active:text-stone-600"
            >
              <X size={16} />
            </button>
          </form>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-base font-medium text-stone-900">{household?.displayName}</p>
              <p className="truncate text-xs text-stone-400">{user?.email}</p>
            </div>
            <button
              onClick={startEditingName}
              className="flex shrink-0 items-center gap-1 rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 active:bg-stone-50"
            >
              <Pencil size={13} /> Edit
            </button>
          </div>
        )}
        {nameError && <p className="mt-2 text-sm text-red-600">{nameError}</p>}
      </Card>

      <Card>
        <h2 className="mb-2 text-sm font-semibold text-stone-700">Household</h2>
        <p className="text-base font-medium text-stone-900">{household?.name}</p>

        <div className="mt-3 rounded-xl bg-stone-50 p-3">
          <p className="text-xs text-stone-500">Invite code</p>
          <p className="mt-0.5 font-mono text-xl font-semibold tracking-[0.2em] text-stone-800">
            {household?.inviteCode}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={shareInvite}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white active:bg-brand-700"
            >
              <Share2 size={15} /> Share invite
            </button>
            <button
              onClick={copyInviteCode}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-600 active:bg-stone-50"
            >
              <Copy size={14} /> {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          {shareNote && <p className="mt-2 text-xs text-brand-700">{shareNote}</p>}
        </div>
        <p className="mt-2 text-xs text-stone-400">
          Your partner enters this code under "Join existing" when they sign up.
        </p>

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
