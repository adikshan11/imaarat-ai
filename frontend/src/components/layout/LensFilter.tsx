import type { Lens } from '@/lib/lens'

interface Props {
  id: string
  lens: Lens
  blur: number
}

export default function LensFilter({ id, lens, blur }: Props) {
  return (
    <filter id={id} x="0" y="0" width={lens.width} height={lens.height} filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
      <feImage href={lens.href} x="0" y="0" width={lens.width} height={lens.height} preserveAspectRatio="none" result="raw" />
      <feGaussianBlur in="raw" stdDeviation="0.9" result="map" />
      <feDisplacementMap in="SourceGraphic" in2="map" scale={lens.scale} xChannelSelector="R" yChannelSelector="G" result="bent" />
      <feGaussianBlur in="bent" stdDeviation={blur} />
    </filter>
  )
}
