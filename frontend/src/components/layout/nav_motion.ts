export function navKey(key: string, index: number, count: number, rtl: boolean) {
  if (!count) return null
  if (key === 'Home') return 0
  if (key === 'End') return count - 1
  if (key !== 'ArrowLeft' && key !== 'ArrowRight') return null
  const step = (key === 'ArrowRight' ? 1 : -1) * (rtl ? -1 : 1)
  return Math.max(0, Math.min(count - 1, index + step))
}

export function navPoint(x: number, bounds: { left: number; right: number }[]) {
  let nearest = -1
  let distance = Infinity
  bounds.forEach((bound, index) => {
    const gap = Math.max(bound.left - x, x - bound.right, 0)
    if (gap < distance) {
      nearest = index
      distance = gap
    }
  })
  return nearest
}