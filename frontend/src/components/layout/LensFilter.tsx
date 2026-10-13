import type { Lens } from '@/lib/lens'

const RED = '1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0'
const GREEN = '0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0'
const BLUE = '0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0'

interface Props {
  id: string
  lens: Lens
  spread: number
  blur: number
  saturate: number
}

export default function LensFilter({ id, lens, spread, blur, saturate }: Props) {
  const channels: Array<[string, number, string]> = [['red', 1 - spread, RED], ['green', 1, GREEN], ['blue', 1 + spread, BLUE]]
  return (
    <filter id={id} x="0" y="0" width={lens.width} height={lens.height} filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
      <feImage href={lens.href} x="0" y="0" width={lens.width} height={lens.height} preserveAspectRatio="none" result="raw" />
      <feGaussianBlur in="raw" stdDeviation="0.9" result="map" />
      {channels.map(([name, factor, matrix]) => (
        <g key={name}>
          <feDisplacementMap in="SourceGraphic" in2="map" scale={lens.scale * factor} xChannelSelector="R" yChannelSelector="G" result={`${name}Bent`} />
          <feColorMatrix in={`${name}Bent`} type="matrix" values={matrix} result={name} />
        </g>
      ))}
      <feBlend in="red" in2="green" mode="screen" result="redGreen" />
      <feBlend in="redGreen" in2="blue" mode="screen" result="bent" />
      <feGaussianBlur in="bent" stdDeviation={blur} result="soft" />
      <feColorMatrix in="soft" type="saturate" values={String(saturate)} />
    </filter>
  )
}
