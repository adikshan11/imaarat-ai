const BEVEL = 12
const SLAB = 16
const INDEX = 1.47
const QUIET = '(prefers-reduced-transparency: reduce), (prefers-contrast: more), (forced-colors: active)'

export const lensSupported = /Chrome\/\d/.test(navigator.userAgent) && !window.matchMedia(QUIET).matches

export interface Lens {
  href: string
  width: number
  height: number
  scale: number
}

const shift = (rise: number) => (SLAB + BEVEL * Math.sqrt(1 - rise * rise)) * Math.tan(Math.asin(rise) - Math.asin(rise / INDEX))

export function lensMap(width: number, height: number): Lens | null {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context || !width || !height) return null
  const radius = height / 2
  const edge = (x: number, y: number) => {
    const qx = Math.abs(x - width / 2) - width / 2 + radius
    const qy = Math.abs(y - height / 2) - height / 2 + radius
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius
  }
  const reach = Math.max(...Array.from({ length: 100 }, (_, step) => shift(step / 100)))
  const image = context.createImageData(width, height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const d = edge(x + 0.5, y + 0.5)
      const rise = Math.min(1 - Math.min(Math.max(-d / BEVEL, 0), 1), 0.99)
      const nx = edge(x + 1, y + 0.5) - edge(x, y + 0.5)
      const ny = edge(x + 0.5, y + 1) - edge(x + 0.5, y)
      const length = Math.hypot(nx, ny) || 1
      const pull = d < 0 ? shift(rise) / reach : 0
      const offset = (y * width + x) * 4
      image.data[offset] = 127.5 - 127.5 * pull * nx / length
      image.data[offset + 1] = 127.5 - 127.5 * pull * ny / length
      image.data[offset + 2] = 128
      image.data[offset + 3] = 255
    }
  }
  context.putImageData(image, 0, 0)
  return { href: canvas.toDataURL(), width, height, scale: reach * 2 }
}
