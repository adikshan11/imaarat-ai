import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { fetchSession, signOut, startSignIn, type Session } from '@/api/session'

type SessionState = {
  session: Session | null
  reviewer: boolean
  error: string | null
  signIn: () => Promise<void>
  signOut: () => Promise<void>
}

const SessionContext = createContext<SessionState | undefined>(undefined)

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

export function useSession() {
  const value = useContext(SessionContext)
  if (!value) throw new Error('useSession must be used inside SessionProvider')
  return value
}
