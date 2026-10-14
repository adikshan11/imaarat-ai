const toggle = document.querySelector<HTMLButtonElement>('#nav-toggle')
const menu = document.querySelector<HTMLElement>('#mobile-menu')

if (toggle && menu) {
  const set = (open: boolean) => {
    toggle.setAttribute('aria-expanded', String(open))
    menu.hidden = !open
  }
  toggle.addEventListener('click', () => set(menu.hidden))
  menu.addEventListener('click', (event) => {
    if ((event.target as Element).closest('a')) set(false)
  })
  document.addEventListener('click', (event) => {
    if (!menu.hidden && !(event.target as Element).closest('#mobile-menu, #nav-toggle')) set(false)
  })
  addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !menu.hidden) {
      set(false)
      toggle.focus()
    }
  })
  matchMedia('(min-width: 768px)').addEventListener('change', (query) => {
    if (query.matches) set(false)
  })
}
