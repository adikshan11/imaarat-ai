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
  list.addEventListener('click', (event) => {
    const tab = (event.target as Element).closest<HTMLButtonElement>('[role="tab"]')
    if (tab) select(tab)
  })
  list.addEventListener('keydown', (event) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (!step) return
    event.preventDefault()
    const next = tabs[(tabs.indexOf(document.activeElement as HTMLButtonElement) + step + tabs.length) % tabs.length]
    select(next)
    next.focus()
  })
}
