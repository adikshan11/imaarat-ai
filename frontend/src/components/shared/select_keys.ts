export type SelectState = { open: boolean; active: number; search: string; typedAt: number }

export function selectKey(state: SelectState, key: string, names: string[], selected: number, now: number, alt = false) {
  const result = { ...state, commit: null as number | null, prevent: false }
  if (!names.length) return { ...result, open: false }
  if (key === 'Escape') return { ...result, open: false, search: '', prevent: state.open }
  if (key === 'Tab' || (state.open && (key === 'Enter' || key === ' ' || (alt && key === 'ArrowUp')))) {
    return { ...result, open: false, search: '', commit: state.open ? state.active : null, prevent: key !== 'Tab' }
  }
  if (['Enter', ' ', 'ArrowDown', 'ArrowUp', 'Home', 'End', 'PageUp', 'PageDown'].includes(key)) {
    let active = state.open ? state.active : Math.max(0, selected)
    if (key === 'Home' || (!state.open && key === 'ArrowUp')) active = 0
    else if (key === 'End') active = names.length - 1
    else if (state.open && !alt && key === 'ArrowDown') active += 1
    else if (state.open && key === 'ArrowUp') active -= 1
    else if (key === 'PageUp') active -= 10
    else if (key === 'PageDown') active += 10
    return { ...result, open: true, active: Math.max(0, Math.min(names.length - 1, active)), search: '', prevent: true }
  }
  if (key.length === 1 && !alt) {
    const search = (now - state.typedAt < 1000 ? state.search : '') + key.toLocaleLowerCase()
    const repeated = [...search].every((letter) => letter === search[0])
    const prefix = repeated ? search[0] : search
    const start = repeated ? (state.open ? state.active : selected) + 1 : state.active
    let active = state.open ? state.active : Math.max(0, selected)
    for (let offset = 0; offset < names.length; offset += 1) {
      const index = (start + offset + names.length) % names.length
      if (names[index].toLocaleLowerCase().startsWith(prefix)) {
        active = index
        break
      }
    }
    return { ...result, open: true, active, search, typedAt: now, prevent: true }
  }
  return result
}

export function placeMenu(rect: { left: number; right: number; top: number; bottom: number; width: number }, viewportWidth: number, viewportHeight: number, desiredHeight: number, rtl: boolean) {
  const width = Math.min(Math.max(rect.width, 180), Math.max(0, viewportWidth - 16))
  const below = Math.max(0, viewportHeight - rect.bottom - 14)
  const above = Math.max(0, rect.top - 14)
  const flip = below < desiredHeight && above > below
  const maxHeight = Math.min(desiredHeight, flip ? above : below)
  return {
    left: Math.max(8, Math.min(rtl ? rect.right - width : rect.left, viewportWidth - width - 8)),
    top: flip ? rect.top - maxHeight - 6 : rect.bottom + 6,
    width,
    maxHeight,
  }
}