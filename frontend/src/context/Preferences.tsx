import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import en from '@/i18n/locales/en.json'

type Messages = Record<string, string>
type Vars = Record<string, string | number>
export type Theme = 'system' | 'light' | 'dark'

interface Preferences {
  dev: boolean
  setDev: (value: boolean) => void
  theme: Theme
  setTheme: (value: Theme) => void
  t: (key: string, vars?: Vars) => string
  label: (prefix: string, id: string) => string
}

const english: Messages = en

const stored = (key: string) => {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

const store = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    return
  }
}

const humanize = (value: string) => value.replaceAll('_', ' ').replace(/^\w/, (letter) => letter.toUpperCase())

const PreferencesContext = createContext<Preferences | undefined>(undefined)

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [dev, setDevState] = useState(() => stored('imaarat.dev') === '1' || ['quality', 'integrations'].includes(window.location.hash.slice(1)))

  const [theme, setTheme] = useState<Theme>(() => {
    const saved = stored('imaarat.theme')
    return saved === 'light' || saved === 'dark' ? saved : 'system'
  })

  useEffect(() => { store('imaarat.dev', dev ? '1' : '0') }, [dev])
  useEffect(() => {
    store('imaarat.theme', theme)
    if (theme === 'system') delete document.documentElement.dataset.theme
    else document.documentElement.dataset.theme = theme
  }, [theme])

  const t = (key: string, vars?: Vars) => {
    const template = english[key] ?? key
    return vars ? template.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match)) : template
  }
  const label = (prefix: string, id: string) => english[`${prefix}.${id}`] ?? humanize(id)

  return <PreferencesContext.Provider value={{ dev, setDev: setDevState, theme, setTheme, t, label }}>{children}</PreferencesContext.Provider>
}

export function usePreferences() {
  const value = useContext(PreferencesContext)
  if (!value) throw new Error('usePreferences must be used inside PreferencesProvider')
  return value
}
