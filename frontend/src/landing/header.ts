const header = document.querySelector<HTMLElement>('.site-header')
const dark = document.querySelectorAll<HTMLElement>('[data-dark]')

if (header && dark.length) {
  const under = new Set<Element>()
  let observer: IntersectionObserver | undefined
  const watch = () => {
    observer?.disconnect()
    under.clear()
    const middle = Math.round(header.offsetHeight / 2)
    const line = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) under.add(entry.target)
        else under.delete(entry.target)
      }
      header.dataset.tone = under.size ? 'dark' : 'light'
    }, { rootMargin: `-${middle}px 0px ${middle + 1 - window.innerHeight}px 0px` })
    dark.forEach((section) => line.observe(section))
    observer = line
  }
  addEventListener('resize', watch)
  watch()
}

const links = new Map([...document.querySelectorAll<HTMLAnchorElement>('.header-links a')].map((link) => [link.hash.slice(1), link]))
const sections = [...links.keys()].map((id) => document.getElementById(id)).filter((section) => section !== null)

if (sections.length) {
  const reading = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const link = links.get(entry.target.id)
      if (entry.isIntersecting) link?.setAttribute('aria-current', 'location')
      else link?.removeAttribute('aria-current')
    }
  }, { rootMargin: '-40% 0px -59% 0px' })
  sections.forEach((section) => reading.observe(section))
}
