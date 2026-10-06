import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import Brand from '@/components/layout/Brand'
import Controls from '@/components/layout/Controls'
import Icon from '@/components/shared/Icon'
import OpticalLabel from '@/components/shared/OpticalLabel'
import { usePreferences } from '@/context/Preferences'
import { navKey, navPoint } from './nav_motion'

interface Props {
  activeView: string
  onNavigate: (view: string) => void
}

export default function Sidebar({ activeView, onNavigate }: Props) {
  const { t, dev, language } = usePreferences()
  const tabbar = useRef<HTMLElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const indicator = useRef<HTMLSpanElement>(null)
  const gesture = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null)
  const blockClick = useRef(false)
  const [scrubbing, setScrubbing] = useState(false)
  useEffect(() => {
    const node = tabbar.current
    if (!node) return
    const shell = node.closest<HTMLElement>('.app-shell')
    const measure = () => shell?.style.setProperty('--tabbar-height', `${node.getBoundingClientRect().height + (parseFloat(getComputedStyle(node).bottom) || 0) + 14}px`)
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
    ...(dev ? [
      { view: 'quality', icon: 'gauge', text: t('nav.quality') },
      { view: 'integrations', icon: 'plug', text: t('nav.integrations') },
    ] : []),
  ]
  const tabs = items.filter((item) => item.view !== 'status')
  const buttons = () => Array.from(track.current?.querySelectorAll<HTMLButtonElement>('.tab-item') ?? [])
  const reveal = (button?: HTMLButtonElement) => {
    const node = tabbar.current
    if (!dev || !node || !button) return
    const bounds = node.getBoundingClientRect()
    const rect = button.getBoundingClientRect()
    if (rect.left < bounds.left + 6) node.scrollLeft += rect.left - bounds.left - 6
    else if (rect.right > bounds.right - 6) node.scrollLeft += rect.right - bounds.right + 6
  }
  const place = (button?: HTMLButtonElement, x?: number) => {
    const node = indicator.current
    const row = track.current
    if (!node || !row || !button) return
    const width = Math.min(button.offsetWidth, button.offsetHeight * 1.35)
    const left = x === undefined ? button.offsetLeft + (button.offsetWidth - width) / 2 : Math.max(0, Math.min(row.offsetWidth - width, x - width / 2))
    node.style.width = `${width}px`
    node.style.transform = `translateX(${left}px)`
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
      reveal(buttons().find((item) => item === document.activeElement) ?? button)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(row)
    buttons().forEach((button) => observer.observe(button))
    measure()
    return () => observer.disconnect()
  }, [activeView, dev, language.code])
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
    }} onFocus={(event) => { if (className === 'tab-item') reveal(event.currentTarget) }} onKeyDown={(event) => {
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
          <Brand sub={t('brand.sub')} />
          <nav className="nav" aria-label={t('nav.section')}>{items.map((item) => link(item, 'nav-item', items))}</nav>
          <div className="sidebar-footer">
            <Controls />
            <div className="sidebar-tagline">{t(dev ? 'footer.dev' : 'footer.underwriter')}</div>
          </div>
        </div>
      </aside>

      <header className="topbar">
        <Brand sub={t('brand.sub')} />
        <Controls compact />
      </header>
      <nav ref={tabbar} className={`tabbar${dev ? ' is-developer' : ''}${scrubbing ? ' is-scrubbing' : ''}`} aria-label={t('nav.section')} onPointerDown={(event) => {
        blockClick.current = false
        if (dev || !event.isPrimary || event.button !== 0) return
        gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false }
      }} onPointerMove={move} onPointerUp={(event) => stop(event)} onPointerCancel={(event) => stop(event, true)} onLostPointerCapture={(event) => { if (event.target === event.currentTarget) stop(event, true) }}>
        <div ref={track} className="tab-track">
          <span ref={indicator} className="tab-indicator" aria-hidden="true" />
          {tabs.map((item) => link(item, 'tab-item', tabs))}
        </div>
      </nav>
    </>
  )
}
