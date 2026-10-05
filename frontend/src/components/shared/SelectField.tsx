import { useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { placeMenu, selectKey, type SelectState } from './select_keys'
import './SelectField.css'

const nativeQuery = '(any-pointer: coarse), (forced-colors: active)'
const nativeSnapshot = () => window.matchMedia(nativeQuery).matches
const nativeServer = () => true
const subscribeNative = (notify: () => void) => {
  const media = window.matchMedia(nativeQuery)
  media.addEventListener('change', notify)
  return () => media.removeEventListener('change', notify)
}

type SelectOption = { value: string; label: string }
type SelectProps = {
  label: string
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  className?: string
}

export default function SelectField({ label, value, options, onChange, className = '' }: SelectProps) {
  const id = useId()
  const labelId = `${id}-label`
  const menuId = `${id}-menu`
  const native = useSyncExternalStore(subscribeNative, nativeSnapshot, nativeServer)
  const selected = options.findIndex((option) => option.value === value)
  const [state, setState] = useState<SelectState>({ open: false, active: Math.max(0, selected), search: '', typedAt: 0 })
  const [position, setPosition] = useState<ReturnType<typeof placeMenu> | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const open = state.open && !native

  const finish = (index: number | null) => {
    if (index !== null && options[index] && options[index].value !== value) onChange(options[index].value)
    setState((current) => ({ ...current, open: false, search: '' }))
    setPosition(null)
  }

  useLayoutEffect(() => {
    if (native) {
      setState((current) => ({ ...current, open: false, search: '' }))
      setPosition(null)
    }
  }, [native])

  useLayoutEffect(() => {
    if (!open) return
    const update = () => {
      if (!trigger.current || !menu.current) return
      const rect = trigger.current.getBoundingClientRect()
      const viewport = window.visualViewport
      const offsetLeft = viewport?.offsetLeft ?? 0
      const offsetTop = viewport?.offsetTop ?? 0
      if (rect.bottom <= offsetTop || rect.top >= offsetTop + (viewport?.height ?? window.innerHeight)) {
        setState((current) => ({ ...current, open: false, search: '' }))
        setPosition(null)
        return
      }
      const next = placeMenu({ left: rect.left - offsetLeft, right: rect.right - offsetLeft, top: rect.top - offsetTop, bottom: rect.bottom - offsetTop, width: rect.width }, viewport?.width ?? window.innerWidth, viewport?.height ?? window.innerHeight, Math.min(280, menu.current.scrollHeight + 2), getComputedStyle(trigger.current).direction === 'rtl')
      next.left += offsetLeft
      next.top += offsetTop
      setPosition((current) => current && Object.keys(next).every((key) => current[key as keyof typeof next] === next[key as keyof typeof next]) ? current : next)
    }
    const scroll = (event: Event) => {
      if (event.target !== menu.current) update()
    }
    update()
    const observer = new ResizeObserver(update)
    if (trigger.current) observer.observe(trigger.current)
    if (menu.current) observer.observe(menu.current)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', scroll, true)
    window.visualViewport?.addEventListener('resize', update)
    window.visualViewport?.addEventListener('scroll', update)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', scroll, true)
      window.visualViewport?.removeEventListener('resize', update)
      window.visualViewport?.removeEventListener('scroll', update)
    }
  }, [open, options])

  useLayoutEffect(() => {
    if (!open) return
    menu.current?.children[state.active]?.scrollIntoView({ block: 'nearest' })
  }, [open, state.active, position?.maxHeight])

  useLayoutEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !trigger.current?.contains(event.target) && !menu.current?.contains(event.target)) finish(state.active)
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  })

  return <>
    <label className={`select-field ${className}`} htmlFor={id}>
      <span className="field-label-text" id={labelId}>{label}</span>
      {native ? <select id={id} className="select-native" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select> : <button
        id={id}
        ref={trigger}
        type="button"
        className="select-trigger"
        role="combobox"
        aria-labelledby={labelId}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-activedescendant={open ? `${id}-option-${state.active}` : undefined}
        disabled={!options.length}
        onClick={() => {
          if (open) finish(null)
          else {
            setPosition(null)
            setState({ open: true, active: Math.max(0, selected), search: '', typedAt: 0 })
          }
        }}
        onBlur={() => { if (open) finish(state.active) }}
        onKeyDown={(event) => {
          if (event.ctrlKey || event.metaKey || event.nativeEvent.isComposing) return
          const next = selectKey({ ...state, open }, event.key, options.map((option) => option.label), selected, Date.now(), event.altKey)
          if (next.prevent) event.preventDefault()
          if (next.commit !== null) finish(next.commit)
          else {
            if (!next.open) setPosition(null)
            setState(next)
          }
        }}
      >
        <span className="select-value">{options[selected]?.label ?? value}</span>
        <svg className="select-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>}
    </label>
    {open && createPortal(<div
      id={menuId}
      ref={menu}
      className="select-menu"
      role="listbox"
      aria-labelledby={labelId}
      dir={trigger.current ? getComputedStyle(trigger.current).direction : undefined}
      style={{ ...position, visibility: position ? 'visible' : 'hidden' }}
      onPointerDown={(event) => event.preventDefault()}
    >{options.map((option, index) => <div
      id={`${id}-option-${index}`}
      key={option.value}
      className={`select-option${index === state.active ? ' is-active' : ''}`}
      role="option"
      aria-selected={index === selected}
      onClick={() => finish(index)}
    >
      <span className="select-option-text">{option.label}</span>
      <svg className="select-check" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" style={{ visibility: index === selected ? 'visible' : 'hidden' }}><path d="m5 12 4 4L19 6" /></svg>
    </div>)}</div>, document.body)}
  </>
}