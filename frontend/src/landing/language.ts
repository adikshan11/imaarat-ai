const select = document.querySelector<HTMLSelectElement>('#landing-language')

if (select) {
  try {
    const saved = localStorage.getItem('imaarat.lang')
    if (saved && [...select.options].some((option) => option.value === saved)) select.value = saved
  } catch {
    select.value = 'en'
  }
  select.addEventListener('change', () => {
    try {
      localStorage.setItem('imaarat.lang', select.value)
    } catch {
      return
    }
    const note = document.createElement('div')
    note.className = 'lang-toast'
    note.setAttribute('role', 'status')
    note.textContent = `The app will open in ${select.selectedOptions[0]?.textContent ?? select.value}. This page stays in English.`
    document.querySelector('.lang-toast')?.remove()
    document.body.append(note)
    window.setTimeout(() => note.remove(), 4000)
  })
}
