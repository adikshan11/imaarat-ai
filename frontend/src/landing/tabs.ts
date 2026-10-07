const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

for (const list of document.querySelectorAll<HTMLElement>('[data-tabs]')) {
  const tabs = [...list.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
  const select = (next: HTMLButtonElement) => {
    for (const tab of tabs) {
      const chosen = tab === next
      tab.setAttribute('aria-selected', String(chosen))
      tab.tabIndex = chosen ? 0 : -1
      document.getElementById(tab.getAttribute('aria-controls') ?? '')?.toggleAttribute('hidden', !chosen)
    }
  }
  const current = () => tabs.findIndex((tab) => tab.getAttribute('aria-selected') === 'true')

  const delay = Number(list.dataset.tabsAuto ?? 0)
  const region = list.closest<HTMLElement>('[data-tabs-region]') ?? list
  const toggle = region.querySelector<HTMLButtonElement>('[data-tabs-toggle]')
  let timer: number | undefined
  let stopped = !delay || reducedMotion
  let hovered = false
  const run = () => {
    window.clearInterval(timer)
    timer = undefined
    if (!stopped && !hovered && !document.hidden) timer = window.setInterval(() => select(tabs[(current() + 1) % tabs.length]), delay)
    if (toggle) {
      toggle.textContent = stopped ? 'Play' : 'Pause'
      toggle.setAttribute('aria-label', stopped ? 'Play the slideshow' : 'Pause the slideshow')
    }
  }
  const stopForGood = () => { stopped = true; run() }

  list.addEventListener('click', (event) => {
    const tab = (event.target as Element).closest<HTMLButtonElement>('[role="tab"]')
    if (!tab) return
    select(tab)
    stopForGood()
  })
  list.addEventListener('keydown', (event) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (!step) return
    event.preventDefault()
    const next = tabs[(tabs.indexOf(document.activeElement as HTMLButtonElement) + step + tabs.length) % tabs.length]
    select(next)
    next.focus()
    stopForGood()
  })
  if (delay && !reducedMotion) {
    toggle?.removeAttribute('hidden')
    toggle?.addEventListener('click', () => { stopped = !stopped; run() })
    region.addEventListener('mouseenter', () => { hovered = true; run() })
    region.addEventListener('mouseleave', () => { hovered = false; run() })
    list.addEventListener('focusin', () => { hovered = true; run() })
    list.addEventListener('focusout', () => { hovered = false; run() })
    document.addEventListener('visibilitychange', run)
    run()
  }
}
