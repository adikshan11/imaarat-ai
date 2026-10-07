import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import en from '@/i18n/locales/en.json'
import { LANGUAGES } from '@/i18n/languages'
import { PreferencesContext, type Vars } from './Preferences'

type Messages = Record<string, string>

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

const loadFont = (family: string) => new Promise<void>((resolve) => {
  const id = `font-${family.replaceAll(' ', '-')}`
  if (document.getElementById(id)) {
    resolve()
    return
  }
  const link = document.createElement('link')
  link.id = id
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${family.replaceAll(' ', '+')}:wght@400;600;700&display=swap`
  link.onload = () => resolve()
  link.onerror = () => resolve()
  document.head.appendChild(link)
})

const initialLanguage = () => {
  const saved = stored('imaarat.lang')
  if (saved && LANGUAGES.some((item) => item.code === saved)) return saved
  const browser = navigator.language.split('-')[0]
  return LANGUAGES.some((item) => item.code === browser) ? browser : 'en'
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [chosen, setChosen] = useState<'light' | 'dark' | null>(() => {
    const saved = stored('imaarat.theme')
    return saved === 'light' || saved === 'dark' ? saved : null
  })
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  const dark = (chosen ?? (systemDark ? 'dark' : 'light')) === 'dark'
  const toggleTheme = () => setChosen(dark ? 'light' : 'dark')
  const [code, setCode] = useState(initialLanguage)
  const [messages, setMessages] = useState<Messages>(english)
  const [shown, setShown] = useState<string | null>(null)
  const firstLoad = useRef(true)
  const language = LANGUAGES.find((item) => item.code === code) ?? LANGUAGES[0]

  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const listen = (event: MediaQueryListEvent) => setSystemDark(event.matches)
    query.addEventListener('change', listen)
    return () => query.removeEventListener('change', listen)
  }, [])
  useEffect(() => {
    if (chosen) {
      store('imaarat.theme', chosen)
      document.documentElement.dataset.theme = chosen
    }
  }, [chosen])
  useEffect(() => {
    let pending = true
    store('imaarat.lang', language.code)
    if (firstLoad.current) {
      firstLoad.current = false
      setShown(language.code)
    }
    const apply = (loaded: Messages) => {
      if (!pending) return
      pending = false
      setMessages(loaded)
      setShown(language.code)
    }
    const loader = locales[`../i18n/locales/${language.code}.json`]
    const ready = loader ? loader().catch(() => english) : Promise.resolve(english)
    void ready.then(async (loaded) => {
      const timer = window.setTimeout(() => apply(loaded), 1500)
      if (language.font) {
        await loadFont(language.font)
        await document.fonts.load(`600 16px '${language.font}'`, Object.values(loaded).slice(0, 40).join(' ')).catch(() => [])
      }
      window.clearTimeout(timer)
      apply(loaded)
    })
    return () => { pending = false }
  }, [language])

  useLayoutEffect(() => {
    const target = LANGUAGES.find((item) => item.code === shown)
    if (!target) return
    const root = document.documentElement
    root.lang = target.code
    root.dir = target.rtl ? 'rtl' : 'ltr'
    root.style.setProperty('--script-font', target.font ? `'${target.font}'` : 'Inter')
  }, [shown])

  const t = (key: string, vars?: Vars) => {
    const template = messages[key] ?? english[key] ?? key
    return vars ? template.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match)) : template
  }
  const label = (prefix: string, id: string) => messages[`${prefix}.${id}`] ?? english[`${prefix}.${id}`] ?? humanize(id)

  return (
    <PreferencesContext.Provider value={{ dark, toggleTheme, language, setLanguage: setCode, t, label, english: (key: string) => english[key] ?? key }}>
      {children}
    </PreferencesContext.Provider>
  )
}
