const toggle = document.querySelector<HTMLButtonElement>('#nav-toggle')
const menu = document.querySelector<HTMLElement>('#mobile-menu')

if (toggle && menu) {
  const set = (open: boolean) => {
    toggle.setAttribute('aria-expanded', String(open))
    menu.hidden = !open
  }
  toggle.addEventListener('click', () => set(toggle.getAttribute('aria-expanded') !== 'true'))
  menu.addEventListener('click', (event) => {
    if ((event.target as Element).closest('a')) set(false)
  })
  document.addEventListener('click', (event) => {
    if (toggle.getAttribute('aria-expanded') === 'true' && !(event.target as Element).closest('#mobile-menu, #nav-toggle')) set(false)
  })
  addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      set(false)
      toggle.focus()
    }
  })
  matchMedia('(min-width: 1024px)').addEventListener('change', (query) => {
    if (query.matches) set(false)
  })
}
