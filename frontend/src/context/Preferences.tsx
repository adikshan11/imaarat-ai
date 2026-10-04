import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import en from '@/i18n/locales/en.json'
import { LANGUAGES } from '@/i18n/languages'
import type { Language } from '@/i18n/languages'

type Messages = Record<string, string>
type Vars = Record<string, string | number>
export type Theme = 'system' | 'light' | 'dark'

interface Preferences {
  dev: boolean
  setDev: (value: boolean) => void
  theme: Theme
  setTheme: (value: Theme) => void
  language: Language
  setLanguage: (code: string) => void
  t: (key: string, vars?: Vars) => string
  label: (prefix: string, id: string) => string
}

const english: Messages = en
const locales = import.meta.glob<Messages>(['../i18n/locales/*.json', '!../i18n/locales/en.json'], { import: 'default' })

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

const loadFont = (family: string) => {
  const id = `font-${family.replaceAll(' ', '-')}`
  if (document.getElementById(id)) return
  const link = document.createElement('link')
  link.id = id
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${family.replaceAll(' ', '+')}:wght@400;600;700&display=swap`
  document.head.appendChild(link)
}

const initialLanguage = () => {
  const saved = stored('imaarat.lang')
  if (saved && LANGUAGES.some((item) => item.code === saved)) return saved
  const browser = navigator.language.split('-')[0]
  return LANGUAGES.some((item) => item.code === browser) ? browser : 'en'
}

const PreferencesContext = createContext<Preferences | undefined>(undefined)

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [dev, setDev] = useState(() => stored('imaarat.dev') === '1' || ['quality', 'integrations'].includes(window.location.hash.slice(1)))
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = stored('imaarat.theme')
    return saved === 'light' || saved === 'dark' ? saved : 'system'
  })
  const [code, setCode] = useState(initialLanguage)
  const [messages, setMessages] = useState<Messages>(english)
  const language = LANGUAGES.find((item) => item.code === code) ?? LANGUAGES[0]

  useEffect(() => { store('imaarat.dev', dev ? '1' : '0') }, [dev])
  useEffect(() => {
    store('imaarat.theme', theme)
    if (theme === 'system') delete document.documentElement.dataset.theme
    else document.documentElement.dataset.theme = theme
  }, [theme])
  useEffect(() => {
    let current = true
    store('imaarat.lang', language.code)
    const root = document.documentElement
    root.lang = language.code
    root.dir = language.rtl ? 'rtl' : 'ltr'
    root.style.setProperty('--script-font', language.font ? `'${language.font}'` : 'Inter')
    if (language.font) loadFont(language.font)
    const loader = locales[`../i18n/locales/${language.code}.json`]
    if (!loader) {
      setMessages(english)
      return
    }
    loader().then((loaded) => { if (current) setMessages(loaded) }).catch(() => { if (current) setMessages(english) })
    return () => { current = false }
  }, [language])

  const t = (key: string, vars?: Vars) => {
    const template = messages[key] ?? english[key] ?? key
    return vars ? template.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match)) : template
  }
  const label = (prefix: string, id: string) => messages[`${prefix}.${id}`] ?? english[`${prefix}.${id}`] ?? humanize(id)

  return (
    <PreferencesContext.Provider value={{ dev, setDev, theme, setTheme, language, setLanguage: setCode, t, label }}>
      {children}
    </PreferencesContext.Provider>
  )
}

export function usePreferences() {
  const value = useContext(PreferencesContext)
  if (!value) throw new Error('usePreferences must be used inside PreferencesProvider')
  return value
}
