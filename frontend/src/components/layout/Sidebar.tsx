import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import Brand from '@/components/layout/Brand'
import Controls from '@/components/layout/Controls'
import Icon from '@/components/shared/Icon'
import OpticalLabel from '@/components/shared/OpticalLabel'
import { usePreferences } from '@/context/Preferences'
import { useSession } from '@/context/Session'
import { type Lens, BAR_SHAPE, BUBBLE_SHAPE, COPY_SHAPE, lensAllowed, lensMap, lensSupported } from '@/lib/lens'
import LensFilter from './LensFilter'
import { navKey, navPoint } from './nav_motion'

interface Props {
  activeView: string
  onNavigate: (view: string) => void
}

export default function Sidebar({ activeView, onNavigate }: Props) {
  const { t, language } = usePreferences()
  const { session } = useSession()
  const tabbar = useRef<HTMLElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const indicator = useRef<HTMLSpanElement>(null)
  const gesture = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null)
  const blockClick = useRef(false)
  const [scrubbing, setScrubbing] = useState(false)
  const [lens, setLens] = useState<Lens | null>(null)
  const [bubble, setBubble] = useState<Lens | null>(null)
  const [rim, setRim] = useState<Lens | null>(null)
  useEffect(() => {
    const node = tabbar.current
    if (!node) return
    const shell = node.closest<HTMLElement>('.app-shell')
    const measure = () => {
      shell?.style.setProperty('--tabbar-height', `${node.getBoundingClientRect().height + (parseFloat(getComputedStyle(node).bottom) || 0) + 14}px`)
      if (lensSupported) setLens((current) => current?.width === node.clientWidth && current.height === node.clientHeight ? current : lensMap(node.clientWidth, node.clientHeight, BAR_SHAPE))
    }
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    measure()
    return () => observer.disconnect()
  }, [])
  const items = [
    { view: 'dashboard', icon: 'grid', text: t('nav.dashboard') },
    { view: 'new', icon: 'plus', text: t('nav.new') },
    { view: 'paper', icon: 'file', text: t('nav.paper') },
    { view: 'how', icon: 'info', text: t('nav.how') },
    { view: 'status', icon: 'monitor', text: t('nav.status') },
    ...(session?.role === 'operator' ? [{ view: 'dev', icon: 'code', text: 'Dev' }] : []),
  ]
  const tabs = items.filter((item) => item.view !== 'status' && item.view !== 'dev')
  const buttons = () => Array.from(track.current?.querySelectorAll<HTMLButtonElement>('.tab-item') ?? [])
  const place = (button?: HTMLButtonElement, x?: number) => {
    const node = indicator.current
    const row = track.current
    if (!node || !row || !button) return
    const width = button.offsetWidth
    const left = x === undefined ? button.offsetLeft : Math.max(0, Math.min(row.offsetWidth - width, x - width / 2))
    node.style.transform = `translateX(${left}px)`
    row.style.setProperty('--lx', `${left}px`)
    row.style.setProperty('--bw', `${width}px`)
    row.style.setProperty('--tw', `${row.offsetWidth}px`)
    const bar = tabbar.current
    if (bar) {
      const half = (width * 0.65 - 30)
      bar.style.setProperty('--ha', `${row.offsetLeft + left + width / 2 - half}px`)
      bar.style.setProperty('--hb', `${row.offsetLeft + left + width / 2 + half}px`)
    }
    buttons().forEach((item) => item.classList.toggle('is-under', item === button))
    node.style.opacity = '1'
  }
  useLayoutEffect(() => {
    const row = track.current
    if (!row) return
    const measure = () => {
      gesture.current = null
      setScrubbing(false)
      const button = buttons().find((item) => item.dataset.view === activeView)
      if (indicator.current) indicator.current.style.opacity = button ? '1' : '0'
      place(button)
      if (lensAllowed && button) {
        const width = button.offsetWidth + 28
        const height = row.offsetHeight + 20
        if (lensSupported) setBubble((current) => current?.width === width && current.height === height ? current : lensMap(width, height, BUBBLE_SHAPE))
        setRim((current) => current?.width === width && current.height === height ? current : lensMap(width, height, COPY_SHAPE))
      }
    }
    const observer = new ResizeObserver(measure)
    observer.observe(row)
    buttons().forEach((button) => observer.observe(button))
    measure()
    return () => observer.disconnect()
  }, [activeView, language.code])
  const stop = (event: PointerEvent<HTMLElement>, cancelled = false) => {
    const current = gesture.current
    if (!current || current.id !== event.pointerId) return
    gesture.current = null
    setScrubbing(false)
    blockClick.current = current.moved
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    const bounds = event.currentTarget.getBoundingClientRect()
    const choices = buttons()
    const index = navPoint(event.clientX, choices.map((button) => button.getBoundingClientRect()))
    if (current.moved && !cancelled && event.clientY >= bounds.top - 24 && event.clientY <= bounds.bottom + 24 && index >= 0) {
      place(choices[index])
      onNavigate(tabs[index].view)
    } else place(choices.find((button) => button.dataset.view === activeView))
  }
  const move = (event: PointerEvent<HTMLElement>) => {
    const current = gesture.current
    if (!current || current.id !== event.pointerId) return
    if (!current.moved) {
      if (Math.abs(event.clientY - current.y) > Math.abs(event.clientX - current.x) && Math.abs(event.clientY - current.y) > 8) {
        stop(event, true)
        return
      }
      if (Math.abs(event.clientX - current.x) < 8) return
      current.moved = true
      blockClick.current = true
      event.currentTarget.setPointerCapture(event.pointerId)
      setScrubbing(true)
    }
    const choices = buttons()
    const index = navPoint(event.clientX, choices.map((button) => button.getBoundingClientRect()))
    const row = track.current?.getBoundingClientRect()
    if (row) place(choices[index], event.clientX - row.left)
  }
  const link = (item: typeof items[number], className: string, list: typeof items) => {
    const caption = className === 'tab-item' && ['dashboard', 'new', 'paper', 'how'].includes(item.view) ? t(`nav.mobile.${item.view}`) : item.text
    return (
    <button key={item.view} data-view={item.view} className={`${className} ${activeView === item.view ? 'active' : ''}`} onClick={(event) => {
      if (className === 'tab-item' && blockClick.current && event.detail !== 0) return
      onNavigate(item.view)
    }} onKeyDown={(event) => {
      const index = navKey(event.key, list.indexOf(item), list.length, Boolean(language.rtl))
      if (index === null) return
      event.preventDefault()
      const parent = event.currentTarget.parentElement
      parent?.querySelectorAll<HTMLButtonElement>('button')[index]?.focus()
    }} aria-label={caption === item.text ? item.text : `${caption} — ${item.text}`} aria-current={activeView === item.view ? 'page' : undefined}>
      <Icon name={item.icon} />
      {className === 'tab-item' ? <span className="tab-caption"><OpticalLabel lang={language.code} text={caption} /></span> : <OpticalLabel lang={language.code} text={caption} />}
    </button>
    )
  }

  return (
    <>
      <aside className="sidebar">
        <div className="sidebar-inner">
          <Brand sub={t('brand.sub')} onHome={() => onNavigate('dashboard')} />
          <nav className="nav" aria-label={t('nav.section')}>{items.map((item) => link(item, 'nav-item', items))}</nav>
          <div className="sidebar-footer">
            <Controls onAccount={() => onNavigate('account')} />
            <div className="sidebar-tagline">{t('footer.underwriter')}</div>
          </div>
        </div>
      </aside>

      <header className="topbar">
        <Brand sub={t('brand.sub')} onHome={() => onNavigate('dashboard')} />
        <Controls compact onAccount={() => onNavigate('account')} />
      </header>
      <nav ref={tabbar} className={`tabbar${scrubbing ? ' is-scrubbing' : ''}${lens ? ' is-lens' : ''}`} aria-label={t('nav.section')} onPointerDown={(event) => {
        blockClick.current = false
        if (!event.isPrimary || event.button !== 0) return
        gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false }
      }} onPointerMove={move} onPointerUp={(event) => stop(event)} onPointerCancel={(event) => stop(event, true)} onLostPointerCapture={(event) => { if (event.target === event.currentTarget) stop(event, true) }}>
        <span className="tab-glass" aria-hidden="true" />
        <div ref={track} className="tab-track">
          <span ref={indicator} className="tab-indicator" aria-hidden="true">
            <span className="tab-copy">
              <span className="tab-copy-row">
                {tabs.map((item) => <span key={item.view} className="tab-copy-item"><Icon name={item.icon} /><span>{t(`nav.mobile.${item.view}`)}</span></span>)}
              </span>
            </span>
          </span>
          {tabs.map((item) => link(item, 'tab-item', tabs))}
        </div>
      </nav>
      {(lens || rim) && (
        <svg className="lens-defs" aria-hidden="true" width="0" height="0">
          {lens && <LensFilter id="tab-lens" lens={lens} spread={0.3} blur={0.5} saturate={1.2} />}
          {bubble && <LensFilter id="tab-bubble" lens={bubble} spread={0.15} blur={0.15} saturate={1.2} />}
          {rim && <LensFilter id="tab-copy" lens={rim} spread={0.35} blur={0} saturate={1} />}
        </svg>
      )}
    </>
  )
}
