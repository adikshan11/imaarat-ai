import { useEffect, useRef, useState } from 'react'
import Icon from '@/components/shared/Icon'
import Mascot from '@/components/assistant/Mascot'
import { askSaathi, type ChatPage, type ChatTurn } from '@/api/assistant'
import { usePreferences } from '@/context/Preferences'
import { listen, listenSupported, speak, speakSupported, stopSpeaking } from '@/lib/speech'
import './Saathi.css'

interface Message extends ChatTurn {
  id: number
  sources?: Array<{ id: string; title: string }>
}

const GREETED = 'imaarat.saathi.greeted'
const SUGGESTIONS = ['saathi.s1', 'saathi.s2', 'saathi.s3']
const NOTICES: Record<string, string> = { limit: 'saathi.limit', refused: 'saathi.refused', offline: 'saathi.offline' }

export default function Saathi({ onOpen }: { onOpen: (page: ChatPage) => void }) {
  const { t, language, setLanguage } = usePreferences()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [listening, setListening] = useState(false)
  const [reading, setReading] = useState(false)
  const [greeting, setGreeting] = useState(false)
  const log = useRef<HTMLDivElement>(null)
  const field = useRef<HTMLInputElement>(null)
  const recognition = useRef<{ stop(): void } | null>(null)
  const counter = useRef(0)

  useEffect(() => {
    if (sessionStorage.getItem(GREETED)) return
    const show = window.setTimeout(() => setGreeting(true), 1800)
    const hide = window.setTimeout(() => { setGreeting(false); sessionStorage.setItem(GREETED, '1') }, 9000)
    return () => { window.clearTimeout(show); window.clearTimeout(hide) }
  }, [])

  useEffect(() => { log.current?.scrollTo({ top: log.current.scrollHeight }) }, [messages, busy])

  useEffect(() => {
    if (open) field.current?.focus()
  }, [open])

  useEffect(() => () => { stopSpeaking(); recognition.current?.stop() }, [])

  const close = () => {
    stopSpeaking()
    recognition.current?.stop()
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      stopSpeaking()
      recognition.current?.stop()
      setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const push = (message: Omit<Message, 'id'>) => setMessages((current) => [...current, { ...message, id: counter.current++ }].slice(-40))

  const send = async (raw: string, spoken = false) => {
    const text = raw.trim()
    if (!text || busy) return
    const history = messages.slice(-6).map(({ role, text: said }) => ({ role, text: said }))
    push({ role: 'user', text })
    setInput('')
    setBusy(true)
    try {
      const result = await askSaathi(text, language.code, history)
      if (result.code === 'ok' && result.reply) {
        push({ role: 'assistant', text: result.reply, sources: result.sources })
        if (spoken || reading) speak(result.reply, result.language ?? language.code)
        if (result.language) setLanguage(result.language)
        if (result.page) {
          onOpen(result.page)
          if (window.matchMedia('(max-width: 900px)').matches) setOpen(false)
        }
      } else {
        push({ role: 'assistant', text: t(NOTICES[result.code] ?? 'saathi.offline') })
      }
    } catch {
      push({ role: 'assistant', text: t('saathi.error') })
    } finally {
      setBusy(false)
    }
  }

  const toggleListening = () => {
    if (listening) {
      recognition.current?.stop()
      return
    }
    stopSpeaking()
    setListening(true)
    recognition.current = listen(
      language.code,
      (text) => { setReading(true); void send(text, true) },
      (heard) => {
        setListening(false)
        if (!heard) push({ role: 'assistant', text: t('saathi.nothing') })
      },
    )
    if (!recognition.current) setListening(false)
  }

  const toggleReading = () => {
    if (reading) stopSpeaking()
    setReading((current) => !current)
  }

  return (
    <>
      {!open && (
        <div className="saathi-launch">
          {greeting && <button type="button" className="saathi-greeting" onClick={() => { setGreeting(false); setOpen(true) }}>{t('saathi.greeting')}</button>}
          <button type="button" className="saathi-fab" aria-label={t('saathi.open')} onClick={() => { setGreeting(false); sessionStorage.setItem(GREETED, '1'); setOpen(true) }}>
            <Mascot size={52} />
          </button>
        </div>
      )}
      {open && (
        <section className="saathi-panel" role="dialog" aria-label="Saathi">
          <header className="saathi-head">
            <span className="saathi-avatar"><Mascot size={40} talking={busy} /></span>
            <div className="saathi-title"><strong>Saathi</strong><span>{t('saathi.tagline')}</span></div>
            {speakSupported && <button type="button" className="saathi-icon" aria-pressed={reading} aria-label={t('saathi.speak')} title={t('saathi.speak')} onClick={toggleReading}><Icon name="speaker" size={18} /></button>}
            <button type="button" className="saathi-icon" aria-label={t('saathi.close')} title={t('saathi.close')} onClick={close}><Icon name="close" size={18} /></button>
          </header>
          <div className="saathi-log" ref={log} role="log" aria-live="polite">
            {messages.length === 0 && (
              <div className="saathi-welcome">
                <p>{t('saathi.welcome')}</p>
                <div className="saathi-chips">{SUGGESTIONS.map((key) => <button type="button" key={key} onClick={() => { void send(t(key)) }}>{t(key)}</button>)}</div>
              </div>
            )}
            {messages.map((message) => (
              <div key={message.id} className={`saathi-turn saathi-${message.role}`}>
                <p>{message.text}</p>
                {message.sources && message.sources.length > 0 && <small>{t('saathi.sources')}: {message.sources.map((source) => source.title).join(', ')}</small>}
              </div>
            ))}
            {busy && <div className="saathi-turn saathi-assistant saathi-typing" role="status" aria-label={t('saathi.thinking')}><i /><i /><i /></div>}
          </div>
          <form className="saathi-form" onSubmit={(event) => { event.preventDefault(); void send(input) }}>
            {listenSupported && <button type="button" className={listening ? 'saathi-icon saathi-mic is-listening' : 'saathi-icon saathi-mic'} aria-pressed={listening} aria-label={listening ? t('saathi.listening') : t('saathi.mic')} title={t('saathi.mic')} onClick={toggleListening}><Icon name="mic" size={18} /></button>}
            <input ref={field} type="text" value={input} maxLength={500} placeholder={listening ? t('saathi.listening') : t('saathi.placeholder')} aria-label={t('saathi.placeholder')} onChange={(event) => setInput(event.target.value)} />
            <button type="submit" className="saathi-send" aria-label={t('saathi.send')} disabled={busy || !input.trim()}><Icon name="send" size={18} /></button>
          </form>
        </section>
      )}
    </>
  )
}
