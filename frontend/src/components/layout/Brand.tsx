import { useEffect, useId, useState } from 'react'

const NAMES = [
  { word: 'imaarat', lang: 'en' },
  { word: 'इमारत', lang: 'hi' },
  { word: 'ইমারত', lang: 'bn' },
  { word: 'இமாரத்', lang: 'ta' },
  { word: 'ಇಮಾರತ್', lang: 'kn' },
  { word: 'ਇਮਾਰਤ', lang: 'pa' },
  { word: 'عمارت', lang: 'ur' },
]

export function BrandMark({ size = 40 }: { size?: number }) {
  const gradient = useId()
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#34d399" />
          <stop offset="1" stopColor="#0f766e" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill={`url(#${gradient})`} />
      <path d="M8 31h24" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="1.6" strokeLinecap="round" />
      <text x="20" y="26.5" textAnchor="middle" fontSize="21" fontWeight="700" fill="#ffffff" fontFamily="'Noto Sans Devanagari', 'Nirmala UI', sans-serif">इ</text>
    </svg>
  )
}

export default function Brand({ sub }: { sub: string }) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % NAMES.length), 2200)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <div className="brand">
      <BrandMark />
      <div className="brand-text">
        <div className="brand-title" aria-label="imaarat.ai">
          {NAMES.map((name, position) => (
            <span key={name.lang} dir="ltr" aria-hidden="true" className={position === index ? 'brand-word is-active' : 'brand-word'}>
              <bdi lang={name.lang}>{name.word}</bdi><span className="brand-tld">.ai</span>
            </span>
          ))}
        </div>
        <div className="brand-sub">{sub}</div>
      </div>
    </div>
  )
}
