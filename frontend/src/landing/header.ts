const header = document.querySelector<HTMLElement>('.site-header')
const dark = [...document.querySelectorAll<HTMLElement>('[data-dark]')]

if (header && dark.length) {
  let frame = 0
  const update = () => {
    frame = 0
    const middle = header.offsetHeight / 2
    header.dataset.tone = dark.some((section) => {
      const box = section.getBoundingClientRect()
      return box.top <= middle && box.bottom > middle
    }) ? 'dark' : 'light'
  }
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(update)
  }
  addEventListener('scroll', schedule, { passive: true })
  addEventListener('resize', schedule)
  update()
}
