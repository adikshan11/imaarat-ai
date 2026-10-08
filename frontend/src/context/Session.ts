import { createContext, useContext } from 'react'
import type { Profile, Provider, Providers, Session } from '@/api/session'

export type SessionState = {
  session: Session | null
  ready: boolean
  providers: Providers
  reviewer: boolean
  error: string | null
  photoVersion: number
  signIn: (provider?: Provider) => Promise<void>
  signOut: () => Promise<void>
  setProfile: (profile: Profile) => void
}

export const SessionContext = createContext<SessionState | undefined>(undefined)

export function useSession() {
  const value = useContext(SessionContext)
  if (!value) throw new Error('useSession must be used inside SessionProvider')
  return value
}
