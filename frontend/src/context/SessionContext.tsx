import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { approvedLogin, SecurityError } from '@/api/security_client.mjs'
import type { SessionIdentity } from '@/api/security_client.mjs'
import { onSessionLost, securityClient } from '@/api/session'

interface SessionState {
  identity: SessionIdentity | null
  loading: boolean
  error: string | null
  revision: number
  refresh: () => Promise<void>
  guest: () => Promise<void>
  login: () => Promise<void>
  logout: () => Promise<void>
}

const SessionContext = createContext<SessionState | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [identity, setIdentity] = useState<SessionIdentity | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const forget = useCallback(() => { setIdentity(null); setRevision((value) => value + 1) }, [])
  const resolve = useCallback(async (guest = false) => {
    setLoading(true)
    setError(null)
    try {
      setIdentity(await securityClient().session(guest))
      setRevision((value) => value + 1)
    } catch (cause) {
      if (cause instanceof SecurityError && cause.code === 'session_changed') return
      securityClient().clear()
      if (!(cause instanceof SecurityError && cause.status === 401)) setError(cause instanceof SecurityError ? cause.message : 'The secure service is unavailable.')
      setIdentity(null)
      setRevision((value) => value + 1)
    } finally { setLoading(false) }
  }, [])
  useEffect(() => {
    const remove = onSessionLost(forget)
    void resolve()
    return remove
  }, [forget, resolve])
  const login = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await securityClient().request<{ authorization_url: string }>('/auth/github/start', { method: 'POST' })
      window.location.assign(approvedLogin(result.authorization_url))
    } catch (cause) { setError(cause instanceof SecurityError ? cause.message : 'Secure sign-in is unavailable.'); setLoading(false) }
  }
  const logout = async () => {
    setLoading(true)
    setError(null)
    try { await securityClient().request('/auth/logout', { method: 'POST' }) }
    catch (cause) { setError(cause instanceof SecurityError ? cause.message : 'Sign-out could not be confirmed.'); }
    finally { securityClient().clear(); forget(); setLoading(false) }
  }
  return <SessionContext.Provider value={{ identity, loading, error, revision, refresh: () => resolve(), guest: () => resolve(true), login, logout }}>{children}</SessionContext.Provider>
}

export function useSession() {
  const value = useContext(SessionContext)
  if (!value) throw new Error('Session provider is required')
  return value
}