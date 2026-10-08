import { createContext, useContext } from 'react'
import type { Profile, Provider, Providers, Session, Timing } from '@/api/session'
import type { SessionEnd } from './useSessionClock'

export type SessionState = {
  session: Session | null
  ready: boolean
  providers: Providers
  reviewer: boolean
  error: string | null
  photoVersion: number
  secondsLeft: number | null
  ended: { reason: Exclude<SessionEnd, 'manual'>; timing: Timing } | null
  signIn: (provider?: Provider) => Promise<void>
  signOut: () => Promise<void>
  staySignedIn: () => Promise<void>
  setProfile: (profile: Profile) => void
}

export const SessionContext = createContext<SessionState | undefined>(undefined)

export function useSession() {
  const value = useContext(SessionContext)
  if (!value) throw new Error('useSession must be used inside SessionProvider')
  return value
}
