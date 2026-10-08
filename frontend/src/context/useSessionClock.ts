import { useEffect, useRef, useState } from 'react'
import type { Session } from '@/api/session'

const WARN_SECONDS = 120
const TOUCH_MS = 60_000
const ACTIVITY = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const
const CHANNEL = 'imaarat.session'

export type SessionEnd = 'idle' | 'max' | 'manual'
type Message = { type: 'touch'; at: number } | { type: 'end'; reason: SessionEnd }

export function announceEnd(reason: SessionEnd) {
  if (typeof BroadcastChannel === 'undefined') return
  const channel = new BroadcastChannel(CHANNEL)
  channel.postMessage({ type: 'end', reason } satisfies Message)
  channel.close()
}

export function useSessionClock(session: Session | null, refresh: () => Promise<Session | null>, end: (reason: SessionEnd) => void) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const deadlines = useRef({ idle: 0, max: 0 })
  const lastTouch = useRef(0)
  const warning = useRef(false)
  const stay = useRef<() => Promise<void>>(async () => undefined)

  useEffect(() => {
    const timing = session?.timing
    if (!timing) {
      warning.current = false
      setSecondsLeft(null)
      return
    }
    const now = Date.now()
    deadlines.current = { idle: now + timing.idle_seconds * 1000, max: timing.expires_at * 1000 + now - timing.now * 1000 }
    lastTouch.current = now
    warning.current = false
    setSecondsLeft(null)

    const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL)
    let timer = 0
    const finish = (reason: SessionEnd, announce = true) => {
      window.clearInterval(timer)
      if (announce) channel?.postMessage({ type: 'end', reason } satisfies Message)
      end(reason)
    }
    const touch = async () => {
      lastTouch.current = Date.now()
      const fresh = await refresh()
      if (!fresh) return finish('idle')
      channel?.postMessage({ type: 'touch', at: Date.now() } satisfies Message)
    }
    const tick = () => {
      const current = Date.now()
      if (current >= deadlines.current.max) return finish('max')
      if (current >= deadlines.current.idle) return finish('idle')
      const left = Math.ceil((Math.min(deadlines.current.idle, deadlines.current.max) - current) / 1000)
      warning.current = left <= WARN_SECONDS
      setSecondsLeft(warning.current ? left : null)
    }
    const active = () => {
      if (!warning.current && Date.now() - lastTouch.current >= TOUCH_MS) void touch()
    }
    const visible = () => {
      if (document.visibilityState === 'visible') tick()
    }
    if (channel) {
      channel.onmessage = (event: MessageEvent<Message>) => {
        if (event.data.type === 'end') return finish(event.data.reason, false)
        deadlines.current.idle = event.data.at + timing.idle_seconds * 1000
        lastTouch.current = event.data.at
        tick()
      }
    }
    stay.current = touch
    timer = window.setInterval(tick, 1000)
    for (const name of ACTIVITY) window.addEventListener(name, active, { passive: true })
    document.addEventListener('visibilitychange', visible)
    return () => {
      window.clearInterval(timer)
      for (const name of ACTIVITY) window.removeEventListener(name, active)
      document.removeEventListener('visibilitychange', visible)
      channel?.close()
    }
  }, [session, refresh, end])

  return { secondsLeft, staySignedIn: () => stay.current() }
}
