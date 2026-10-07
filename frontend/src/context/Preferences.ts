import { createContext, useContext } from 'react'
import type { Language } from '@/i18n/languages'

export type Vars = Record<string, string | number>

export interface Preferences {
  dark: boolean
  toggleTheme: () => void
  language: Language
  setLanguage: (code: string) => void
  t: (key: string, vars?: Vars) => string
  label: (prefix: string, id: string) => string
  english: (key: string) => string
}

export const PreferencesContext = createContext<Preferences | undefined>(undefined)

export function usePreferences() {
  const value = useContext(PreferencesContext)
  if (!value) throw new Error('usePreferences must be used inside PreferencesProvider')
  return value
}
