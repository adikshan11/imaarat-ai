import { useEffect, useState } from 'react'
import { usePreferences } from '@/context/Preferences'
import './Loader.css'

export function PageSkeleton({ heading = true }: { heading?: boolean }) {
  const { t } = usePreferences()
  return (
    <div className="skeleton-page" aria-busy="true">
      <span className="sr-only" role="status">{t('load.loading')}</span>
      {heading && <>
        <div className="skeleton skeleton-eyebrow" />
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-line" />
      </>}
      <div className="skeleton-kpis">{[0, 1, 2, 3].map((item) => <div className="skeleton skeleton-kpi" key={item} />)}</div>
      <div className="skeleton skeleton-card" />
      <div className="skeleton skeleton-card" />
    </div>
  )
}

export function Spinner() {
  return <span className="spinner" aria-hidden="true" />
}

export function TopProgress() {
  const { t } = usePreferences()
  return <div className="top-progress" role="progressbar" aria-label={t('load.loading')}><span /></div>
}

export function AiProgress({ title, hint, steps }: { title: string; hint: string; steps: string[] }) {
  const { t } = usePreferences()
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    const started = Date.now()
    const timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000)
    return () => window.clearInterval(timer)
  }, [])
  return (
    <div className="ai-progress" role="status" aria-live="polite">
      <div className="ai-progress-head">
        <span className="pixel-grid" aria-hidden="true">{Array.from({ length: 9 }, (_, index) => <i key={index} style={{ animationDelay: `${(index % 3 + Math.floor(index / 3)) * 120}ms` }} />)}</span>
        <div>
          <strong>{title}</strong>
          <span className="ai-progress-time" aria-hidden="true">{t('load.elapsed', { seconds })}</span>
        </div>
      </div>
      <p className="ai-progress-hint">{hint}</p>
      <ul className="ai-progress-steps">{steps.map((step) => <li key={step}>{step}</li>)}</ul>
    </div>
  )
}
