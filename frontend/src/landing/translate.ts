import { LANGUAGES } from '../i18n/languages.ts'

type Dictionary = Record<string, string>

const dictionaries = import.meta.glob<Dictionary>('./copy/dictionaries/*.json', { import: 'default' })
const SAME_TEXT_AS: Record<string, string> = { bho: 'hi', hne: 'hi', tcy: 'kn' }
const KEEP = new Set(['X', 'LinkedIn', 'III', 'P2'])
const SKIP = 'script,style,noscript,[translate="no"]'
const LETTERS = /\p{L}/u
const ATTRIBUTES = ['alt', 'aria-label', 'title']
const FALLBACK = "ui-sans-serif, system-ui, 'Segoe UI', Roboto, sans-serif"

interface TextSlot {
  node: Text
  value: string
  key: string
  parent: Element
  dir: string | null
}

interface AttributeSlot {
  element: Element
  name: string
  value: string
}

let slots: { text: TextSlot[]; attributes: AttributeSlot[] } | undefined
let latest = 0
const pageTitle = document.title
const description = document.querySelector<HTMLMetaElement>('meta[name="description"]')
const pageDescription = description?.content ?? ''

function collect() {
  if (slots) return slots
  const text: TextSlot[] = []
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const value = node.nodeValue ?? ''
    const key = value.trim()
    const parent = node.parentElement
    if (!key || !LETTERS.test(key) || KEEP.has(key) || !parent || parent.closest(SKIP)) continue
    text.push({ node: node as Text, value, key, parent, dir: parent.getAttribute('dir') })
  }
  const attributes: AttributeSlot[] = []
  for (const element of document.body.querySelectorAll(ATTRIBUTES.map((name) => `[${name}]`).join(','))) {
    if (element.closest(SKIP)) continue
    for (const name of ATTRIBUTES) {
      const value = element.getAttribute(name)
      if (value && LETTERS.test(value)) attributes.push({ element, name, value })
    }
  }
  slots = { text, attributes }
  return slots
}

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
  document.head.append(link)
})

function restore() {
  const { text, attributes } = collect()
  for (const slot of text) {
    slot.node.nodeValue = slot.value
    if (slot.dir === null) slot.parent.removeAttribute('dir')
    else slot.parent.setAttribute('dir', slot.dir)
  }
  for (const slot of attributes) slot.element.setAttribute(slot.name, slot.value)
  document.title = pageTitle
  if (description) description.content = pageDescription
  const root = document.documentElement
  root.lang = 'en'
  root.style.removeProperty('--font-sans')
  root.dataset.landingLang = 'en'
  root.dataset.landingMissing = '0'
}

export async function applyLanguage(code: string) {
  const turn = ++latest
  const shown = LANGUAGES.find((item) => item.code === (SAME_TEXT_AS[code] ?? code))
  const load = dictionaries[`./copy/dictionaries/${shown?.code}.json`]
  if (code === 'en' || !shown || !load) {
    restore()
    return
  }
  const [dictionary] = await Promise.all([load(), shown.font ? loadFont(shown.font) : Promise.resolve()])
  if (turn !== latest) return
  if (shown.font) {
    const sample = Object.values(dictionary).slice(0, 12).join(' ')
    await Promise.race([document.fonts.load(`600 16px '${shown.font}'`, sample).catch(() => []), new Promise((resolve) => setTimeout(resolve, 1500))])
    if (turn !== latest) return
  }
  const { text, attributes } = collect()
  let missing = 0
  for (const slot of text) {
    const translated = dictionary[slot.key]
    if (!translated) {
      missing += 1
      continue
    }
    slot.node.nodeValue = slot.value.replace(slot.key, () => translated)
    if (shown.rtl) slot.parent.setAttribute('dir', 'rtl')
    else if (slot.dir === null) slot.parent.removeAttribute('dir')
  }
  for (const slot of attributes) {
    const translated = dictionary[slot.value.trim()]
    if (translated) slot.element.setAttribute(slot.name, translated)
    else missing += 1
  }
  const title = dictionary[pageTitle]
  if (title) document.title = title
  const summary = dictionary[pageDescription]
  if (description && summary) description.content = summary
  const root = document.documentElement
  root.lang = shown.code
  root.style.setProperty('--font-sans', shown.font ? `Inter, '${shown.font}', ${FALLBACK}` : `Inter, ${FALLBACK}`)
  root.dataset.landingLang = code
  root.dataset.landingMissing = String(missing)
}
