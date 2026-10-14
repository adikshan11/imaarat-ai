import { LANGUAGES } from '../i18n/languages.ts'
import { applyLanguage } from './translate.ts'

const picker = document.querySelector<HTMLElement>('[data-lang-pick]')
const button = picker?.querySelector<HTMLButtonElement>('#landing-language')
const list = picker?.querySelector<HTMLElement>('#lang-list')
const current = button?.querySelector<HTMLElement>('.lang-current')

const remembered = () => {
  try {
    return localStorage.getItem('imaarat.lang')
  } catch {
    return null
  }
}

const remember = (code: string) => {
  try {
    localStorage.setItem('imaarat.lang', code)
  } catch {
    return
  }
}

if (picker && button && list && current) {
  const options = [...list.querySelectorAll<HTMLElement>('[role="option"]')]
  const saved = options.findIndex((option) => option.dataset.code === remembered())
  let selected = Math.max(saved, 0)
  let active = selected

  const choose = (index: number) => {
    selected = index
    const code = options[index]?.dataset.code ?? 'en'
    for (const [position, option] of options.entries()) option.setAttribute('aria-selected', String(position === index))
    const language = LANGUAGES.find((item) => item.code === code)
    current.textContent = language?.name ?? 'English'
    current.lang = code
    current.dir = language?.rtl ? 'rtl' : 'ltr'
    void applyLanguage(code)
  }

  const highlight = (index: number) => {
    active = Math.min(Math.max(index, 0), options.length - 1)
    for (const [position, option] of options.entries()) option.classList.toggle('is-active', position === active)
    list.setAttribute('aria-activedescendant', options[active]?.id ?? '')
    options[active]?.scrollIntoView({ block: 'nearest' })
  }

  const close = (focus: boolean) => {
    list.hidden = true
    button.setAttribute('aria-expanded', 'false')
    if (focus) button.focus()
  }

  const open = () => {
    list.hidden = false
    button.setAttribute('aria-expanded', 'true')
    highlight(selected)
    list.focus({ preventScroll: true })
  }

  const pick = (index: number) => {
    remember(options[index]?.dataset.code ?? 'en')
    choose(index)
    close(true)
  }

  button.addEventListener('click', () => (list.hidden ? open() : close(false)))
  button.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    if (list.hidden) open()
  })
  list.addEventListener('keydown', (event) => {
    const moves: Record<string, number> = { ArrowDown: active + 1, ArrowUp: active - 1, Home: 0, End: options.length - 1, PageDown: active + 6, PageUp: active - 6 }
    if (event.key in moves) {
      event.preventDefault()
      highlight(moves[event.key])
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      pick(active)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      close(true)
    } else if (event.key === 'Tab') {
      close(false)
    }
  })
  list.addEventListener('pointermove', (event) => {
    const option = (event.target as Element).closest<HTMLElement>('[role="option"]')
    if (option) highlight(options.indexOf(option))
  })
  list.addEventListener('click', (event) => {
    const option = (event.target as Element).closest<HTMLElement>('[role="option"]')
    if (option) pick(options.indexOf(option))
  })
  document.addEventListener('pointerdown', (event) => {
    if (!list.hidden && !picker.contains(event.target as Node)) close(false)
  })

  if (selected > 0) choose(selected)
}
