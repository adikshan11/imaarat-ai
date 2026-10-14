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
if (speakSupported) window.speechSynthesis.getVoices()

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

let session = 0

const normal = (tag: string) => tag.replace('_', '-')

function pickVoice(lang: string): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices()
  const base = lang.split('-')[0]
  const same = voices.filter((voice) => normal(voice.lang) === lang)
  const close = voices.filter((voice) => normal(voice.lang).startsWith(`${base}-`) || voice.lang === base)
  const pool = same.length ? same : close
  return pool.find((voice) => voice.localService) ?? pool[0]
}

function voicesReady(): Promise<void> {
  const synth = window.speechSynthesis
  if (synth.getVoices().length) return Promise.resolve()
  return new Promise((resolve) => {
    const finish = () => {
      synth.removeEventListener('voiceschanged', finish)
      resolve()
    }
    synth.addEventListener('voiceschanged', finish)
    window.setTimeout(finish, 800)
  })
}

export function speak(text: string, code: string) {
  if (!speakSupported) return
  const synth = window.speechSynthesis
  const lang = speechLanguage(code)
  const parts = (text.match(/[^.!?।۔]+[.!?।۔]*\s*/g) ?? [text]).map((part) => part.trim()).filter(Boolean)
  const id = ++session
  synth.cancel()
  const say = (index: number, attempt: number, voice: SpeechSynthesisVoice | undefined) => {
    if (id !== session || index >= parts.length) return
    const utterance = new SpeechSynthesisUtterance(parts[index])
    utterance.lang = voice?.lang ?? lang
    if (voice && attempt === 0) utterance.voice = voice
    let settled = false
    let started = false
    const settle = (action: () => void) => {
      if (settled || id !== session) return
      settled = true
      window.clearTimeout(startGuard)
      window.clearTimeout(endGuard)
      action()
    }
    const retryOrSkip = () => settle(() => {
      synth.cancel()
      window.setTimeout(() => (attempt < 1 ? say(index, attempt + 1, voice) : say(index + 1, 0, voice)), 150)
    })
    const startGuard = window.setTimeout(() => { if (!started) retryOrSkip() }, 6000)
    const endGuard = window.setTimeout(() => settle(() => { synth.cancel(); say(index + 1, 0, voice) }), 30000)
    utterance.onstart = () => {
      started = true
      window.clearTimeout(startGuard)
    }
    utterance.onend = () => settle(() => say(index + 1, 0, voice))
    utterance.onerror = (event) => {
      if (event.error === 'interrupted' || event.error === 'canceled') return
      retryOrSkip()
    }
    synth.speak(utterance)
  }
  void voicesReady().then(() => {
    if (id !== session) return
    const voice = pickVoice(lang)
    window.setTimeout(() => {
      if (id !== session) return
      synth.resume()
      say(0, 0, voice)
    }, 120)
  })
}

export function stopSpeaking() {
  session += 1
  if (speakSupported) window.speechSynthesis.cancel()
}
