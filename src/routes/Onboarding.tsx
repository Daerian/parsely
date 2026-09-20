import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

export default function Onboarding() {
  const { refreshHousehold, signOut } = useAuth()
  const [mode, setMode] = useState<'create' | 'join'>('create')
  const [displayName, setDisplayName] = useState('')
  const [householdName, setHouseholdName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (mode === 'create') {
        const { error } = await supabase.rpc('create_household', {
          household_name: householdName,
          member_display_name: displayName,
        })
        if (error) throw error
      } else {
        const { error } = await supabase.rpc('join_household', {
          code: inviteCode,
          member_display_name: displayName,
        })
        if (error) throw error
      }
      await refreshHousehold()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-dvh flex-col items-center justify-center bg-stone-50 px-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold text-stone-800">Set up your household</h1>
          <p className="mt-1 text-sm text-stone-500">
            Create a household, or join your partner's with their invite code.
          </p>
        </div>

        <div className="mb-4 flex rounded-xl bg-stone-100 p-1 text-sm font-medium">
          <button
            className={`flex-1 rounded-lg py-2 ${mode === 'create' ? 'bg-white shadow-sm' : 'text-stone-500'}`}
            onClick={() => setMode('create')}
          >
            Create new
          </button>
          <button
            className={`flex-1 rounded-lg py-2 ${mode === 'join' ? 'bg-white shadow-sm' : 'text-stone-500'}`}
            onClick={() => setMode('join')}
          >
            Join existing
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            required
            placeholder="Your name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded-xl border border-stone-300 px-4 py-3 text-base focus:border-brand-500 focus:outline-none"
          />

          {mode === 'create' ? (
            <input
              required
              placeholder="Household name (e.g. The Smiths)"
              value={householdName}
              onChange={(e) => setHouseholdName(e.target.value)}
              className="w-full rounded-xl border border-stone-300 px-4 py-3 text-base focus:border-brand-500 focus:outline-none"
            />
          ) : (
            <input
              required
              placeholder="Invite code"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              maxLength={6}
              className="w-full rounded-xl border border-stone-300 px-4 py-3 text-base uppercase tracking-widest focus:border-brand-500 focus:outline-none"
            />
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-brand-600 px-4 py-3 text-base font-semibold text-white active:bg-brand-700 disabled:opacity-60"
          >
            {loading ? 'Please wait…' : mode === 'create' ? 'Create household' : 'Join household'}
          </button>
        </form>

        <button onClick={() => signOut()} className="mt-4 w-full text-center text-sm text-stone-400">
          Sign out
        </button>
      </div>
    </div>
  )
}
