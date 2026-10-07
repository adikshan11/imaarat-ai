import { createContext, useContext } from 'react'
import type { Session } from '@/api/session'

export type SessionState = {
  session: Session | null
  reviewer: boolean
  error: string | null
  signIn: () => Promise<void>
  signOut: () => Promise<void>
}

export const SessionContext = createContext<SessionState | undefined>(undefined)

export function useSession() {
  const value = useContext(SessionContext)
  if (!value) throw new Error('useSession must be used inside SessionProvider')
  return value
}
