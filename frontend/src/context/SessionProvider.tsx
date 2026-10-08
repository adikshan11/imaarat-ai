import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { fetchProviders, fetchSession, signOut, startSignIn, type Providers, type Session } from '@/api/session'
import { SessionContext, type SessionState } from './Session'
import { announceEnd, useSessionClock, type SessionEnd } from './useSessionClock'

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [providers, setProviders] = useState<Providers>({ github: true, google: false })
  const [error, setError] = useState<string | null>(null)
  const [photoVersion, setPhotoVersion] = useState(() => Date.now())
  const [ended, setEnded] = useState<SessionState['ended']>(null)
  const current = useRef(session)
  useEffect(() => { current.current = session }, [session])
  useEffect(() => {
    fetchSession().then(setSession).catch(() => setSession(null)).finally(() => setReady(true))
    fetchProviders().then(setProviders).catch(() => undefined)
  }, [])
  const refresh = useCallback(async () => {
    const fresh = await fetchSession().catch(() => null)
    if (fresh) setSession(fresh)
    return fresh
  }, [])
  const end = useCallback((reason: SessionEnd) => {
    const last = current.current
    if (!last) return
    void signOut(last.csrf_token).catch(() => undefined)
    setSession(null)
    setEnded(reason === 'manual' ? null : { reason, timing: last.timing })
    window.location.hash = 'signin'
  }, [])
  const { secondsLeft, staySignedIn } = useSessionClock(session, refresh, end)
  const value: SessionState = {
    session,
    ready,
    providers,
    reviewer: session?.role === 'reviewer' || session?.role === 'operator',
    error,
    photoVersion,
    secondsLeft,
    ended,
    staySignedIn,
    signIn: async (provider) => {
      setError(null)
      try { await startSignIn(provider) } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)) }
    },
    signOut: async () => {
      if (session) await signOut(session.csrf_token).catch(() => undefined)
      announceEnd('manual')
      setEnded(null)
      setSession(null)
    },
    setProfile: (profile) => {
      setSession((previous) => previous && { ...previous, profile })
      setPhotoVersion(Date.now())
    },
  }
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
