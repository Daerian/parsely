import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'

export interface HouseholdInfo {
  id: string
  name: string
  inviteCode: string
  displayName: string
}

interface AuthContextValue {
  loading: boolean
  session: Session | null
  user: User | null
  household: HouseholdInfo | null
  refreshHousehold: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [household, setHousehold] = useState<HouseholdInfo | null>(null)

  async function loadHousehold(userId: string) {
    const { data, error } = await supabase
      .from('household_members')
      .select('display_name, households(id, name, invite_code)')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle()

    if (error || !data || !data.households) {
      setHousehold(null)
      return
    }

    const h = data.households as unknown as { id: string; name: string; invite_code: string }
    setHousehold({ id: h.id, name: h.name, inviteCode: h.invite_code, displayName: data.display_name })
  }

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return
      setSession(data.session)
      if (data.session?.user) await loadHousehold(data.session.user.id)
      setLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession)
      if (newSession?.user) {
        await loadHousehold(newSession.user.id)
      } else {
        setHousehold(null)
      }
    })

    return () => {
      mounted = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  const value: AuthContextValue = {
    loading,
    session,
    user: session?.user ?? null,
    household,
    refreshHousehold: async () => {
      if (session?.user) await loadHousehold(session.user.id)
    },
    signOut: async () => {
      await supabase.auth.signOut()
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
