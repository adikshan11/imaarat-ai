import { useEffect, useState, type ReactNode } from 'react'
import { fetchSession, signOut, startSignIn, type Session } from '@/api/session'
import { SessionContext, type SessionState } from './Session'

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { fetchSession().then(setSession).catch(() => setSession(null)) }, [])
  const value: SessionState = {
    session,
    reviewer: session?.role === 'reviewer' || session?.role === 'operator',
    error,
    signIn: async () => {
      setError(null)
      try { await startSignIn() } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)) }
    },
    signOut: async () => {
      if (session) await signOut(session.csrf_token).catch(() => undefined)
      setSession(null)
    },
  }
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
