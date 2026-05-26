import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../config/supabase'
import { getCurrentProfile } from '../services/supabaseMarketplace'

const AuthContext = createContext(null)
const AUTH_TIMEOUT_MS = 8000

function withTimeout(promise, fallback, timeoutMs = AUTH_TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise((resolve) => {
      window.setTimeout(() => resolve(fallback), timeoutMs)
    }),
  ])
}

function isSessionError(error) {
  const text = `${error?.message || ''} ${error?.error_description || ''} ${error?.error || ''}`.toLowerCase()
  return text.includes('jwt') || text.includes('token') || text.includes('refresh')
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return undefined
    }

    let active = true

    const loadProfile = async (nextUser) => {
      if (!nextUser) {
        setProfile(null)
        setLoading(false)
        return
      }

      try {
        const nextProfile = await withTimeout(getCurrentProfile(nextUser.id), null)
        if (active) setProfile(nextProfile)
      } catch (error) {
        console.error('Could not load profile:', error)
        if (active) {
          setProfile(null)
          if (isSessionError(error)) {
            setUser(null)
            supabase.auth.signOut({ scope: 'local' }).catch(() => {})
          }
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    const loadSession = async () => {
      setLoading(true)
      try {
        const { data } = await withTimeout(supabase.auth.getSession(), { data: { session: null } })
        if (!active) return

        const nextUser = data.session?.user || null
        setUser(nextUser)
        await loadProfile(nextUser)
      } catch (error) {
        console.error('Could not load session:', error)
        if (!active) return
        setUser(null)
        setProfile(null)
        if (isSessionError(error)) {
          supabase.auth.signOut({ scope: 'local' }).catch(() => {})
        }
        setLoading(false)
      }
    }

    loadSession()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user || null
      setUser(nextUser)
      setLoading(true)

      window.setTimeout(() => {
        if (active) loadProfile(nextUser)
      }, 0)
    })

    return () => {
      active = false
      listener?.subscription?.unsubscribe()
    }
  }, [])

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      role: profile?.role || null,
    }),
    [loading, profile, user]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return value
}
