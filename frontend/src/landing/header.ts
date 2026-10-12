const header = document.querySelector<HTMLElement>('.site-header')
const hero = document.querySelector<HTMLElement>('[data-hero]')

if (header && hero) {
  let frame = 0
  const update = () => {
    frame = 0
    header.dataset.tone = hero.getBoundingClientRect().bottom > header.offsetHeight ? 'dark' : 'light'
  }
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(update)
  }
  addEventListener('scroll', schedule, { passive: true })
  addEventListener('resize', schedule)
  update()
}
