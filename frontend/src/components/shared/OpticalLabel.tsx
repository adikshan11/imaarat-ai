import { useEffect, useRef } from 'react'

export default function OpticalLabel({ text, lang }: { text: string; lang: string }) {
  const label = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const node = label.current
    if (!node) return
    const context = document.createElement('canvas').getContext('2d')
    if (!context) return
    let active = true
    const alignLabel = () => {
      if (!active || !node.firstChild) return
      const bounds = node.getBoundingClientRect()
      if (!bounds.height) return
      const style = getComputedStyle(node)
      context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
      context.direction = style.direction === 'rtl' ? 'rtl' : 'ltr'
      const content = node.firstChild.textContent ?? ''
      const lines = new Map<number, string>()
      const range = document.createRange()
      for (let index = 0; index < content.length; index++) {
        range.setStart(node.firstChild, index)
        range.setEnd(node.firstChild, index + 1)
        const top = range.getBoundingClientRect().top
        lines.set(top, (lines.get(top) ?? '') + content[index])
      }
      const baseline = document.createElement('span')
      baseline.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline;transform:none;line-height:0'
      node.appendChild(baseline)
      const lastBaseline = baseline.getBoundingClientRect().top
      baseline.remove()
      const lastTop = Math.max(...lines.keys())
      let inkTop = Infinity
      let inkBottom = -Infinity
      for (const [top, line] of lines) {
        const metrics = context.measureText(line)
        const lineBaseline = lastBaseline - lastTop + top
        inkTop = Math.min(inkTop, lineBaseline - metrics.actualBoundingBoxAscent)
        inkBottom = Math.max(inkBottom, lineBaseline + metrics.actualBoundingBoxDescent)
      }
      const offset = bounds.height / 2 - ((inkTop + inkBottom) / 2 - bounds.top)
      node.style.setProperty('--label-offset', `${Number.isFinite(offset) ? offset : 0}px`)
    }
    alignLabel()
    void document.fonts.ready.then(alignLabel)
    document.fonts.addEventListener('loadingdone', alignLabel)
    const observer = new ResizeObserver(alignLabel)
    observer.observe(node)
    return () => {
      active = false
      observer.disconnect()
      document.fonts.removeEventListener('loadingdone', alignLabel)
    }
  }, [text, lang])

  return <span ref={label} className="optical-label" lang={lang}>{text}</span>
}