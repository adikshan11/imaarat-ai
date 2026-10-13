const BROWSER_LANGUAGES: Record<string, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  bn: 'bn-IN',
  te: 'te-IN',
  mr: 'mr-IN',
  ta: 'ta-IN',
  ur: 'ur-IN',
  gu: 'gu-IN',
  kn: 'kn-IN',
  ml: 'ml-IN',
  pa: 'pa-IN',
  or: 'or-IN',
  as: 'as-IN',
  ne: 'ne-NP',
  mai: 'hi-IN',
  doi: 'hi-IN',
  gom: 'hi-IN',
  bho: 'hi-IN',
  hne: 'hi-IN',
  sa: 'hi-IN',
  sd: 'ur-IN',
  ks: 'ur-IN',
  mni: 'bn-IN',
  brx: 'hi-IN',
  sat: 'hi-IN',
  tcy: 'kn-IN',
}

interface Recognition {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
}

interface SpeechWindow {
  SpeechRecognition?: new () => Recognition
  webkitSpeechRecognition?: new () => Recognition
}

const Engine = (window as unknown as SpeechWindow).SpeechRecognition ?? (window as unknown as SpeechWindow).webkitSpeechRecognition

export const listenSupported = Boolean(Engine)
export const speakSupported = 'speechSynthesis' in window

export const speechLanguage = (code: string) => BROWSER_LANGUAGES[code] ?? 'en-IN'

export function listen(code: string, onText: (text: string) => void, onEnd: (heard: boolean) => void): Recognition | null {
  if (!Engine) return null
  const recognition = new Engine()
  let heard = false
  recognition.lang = speechLanguage(code)
  recognition.interimResults = false
  recognition.maxAlternatives = 1
  recognition.onresult = (event) => {
    const text = event.results[0]?.[0]?.transcript?.trim()
    if (!text) return
    heard = true
    onText(text)
  }
  recognition.onerror = () => onEnd(heard)
  recognition.onend = () => onEnd(heard)
  recognition.start()
  return recognition
}

export function speak(text: string, code: string) {
  if (!speakSupported) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = speechLanguage(code)
  utterance.rate = 1
  window.speechSynthesis.speak(utterance)
}

export function stopSpeaking() {
  if (speakSupported) window.speechSynthesis.cancel()
}
