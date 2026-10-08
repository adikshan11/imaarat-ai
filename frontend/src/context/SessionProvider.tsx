import { useEffect, useState, type ReactNode } from 'react'
import { fetchProviders, fetchSession, signOut, startSignIn, type Providers, type Session } from '@/api/session'
import { SessionContext, type SessionState } from './Session'

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [providers, setProviders] = useState<Providers>({ github: true, google: false })
  const [error, setError] = useState<string | null>(null)
  const [photoVersion, setPhotoVersion] = useState(() => Date.now())
  useEffect(() => {
    fetchSession().then(setSession).catch(() => setSession(null)).finally(() => setReady(true))
    fetchProviders().then(setProviders).catch(() => undefined)
  }, [])
  const value: SessionState = {
    session,
    ready,
    providers,
    reviewer: session?.role === 'reviewer' || session?.role === 'operator',
    error,
    photoVersion,
    signIn: async (provider) => {
      setError(null)
      try { await startSignIn(provider) } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)) }
    },
    signOut: async () => {
      if (session) await signOut(session.csrf_token).catch(() => undefined)
      setSession(null)
    },
    setProfile: (profile) => {
      setSession((current) => current && { ...current, profile })
      setPhotoVersion(Date.now())
    },
  }
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
