import { useEffect, useState } from 'react'

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
  return (
    <img className="brand-mark" src="/favicon.svg?v=imaarat-3" width={size} height={size} alt="" aria-hidden="true" />
  )
}

export default function Brand({ sub, onHome }: { sub: string; onHome: () => void }) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % NAMES.length), 2200)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <a className="brand" href="/app/" onClick={(event) => { event.preventDefault(); onHome() }}>
      <BrandMark />
      <div className="brand-text">
        <div className="brand-title">
          <span className="sr-only">imaarat.ai</span>
          {NAMES.map((name, position) => (
            <span key={name.lang} dir="ltr" aria-hidden="true" className={position === index ? 'brand-word is-active' : 'brand-word'}>
              <bdi lang={name.lang}>{name.word}</bdi><span className="brand-tld">.ai</span>
            </span>
          ))}
        </div>
        <div className="brand-sub">{sub}</div>
      </div>
    </a>
  )
}
