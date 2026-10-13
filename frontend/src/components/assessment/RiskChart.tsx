import { useEffect, useState } from 'react'
import Card from '@/components/shared/Card'
import { usePreferences } from '@/context/Preferences'
import type { OfficialHazard } from '@/types/backend'
import './RiskChart.css'

const CX = 110
const CY = 110
const RADIUS = 90
const BANDS = [
  { from: 0, to: 30, tone: 'accept', decision: 'Accept' },
  { from: 31, to: 60, tone: 'refer', decision: 'Refer' },
  { from: 61, to: 84, tone: 'decline', decision: 'Decline (mitigation possible)' },
  { from: 85, to: 100, tone: 'auto', decision: 'Auto-Decline' },
]
const ZONES: Record<string, number> = { II: 20, III: 40, IV: 60, V: 80, VI: 100 }
const GRADES: Record<string, number> = { P1: 100, P2: 75, P3: 50, P4: 25 }

const point = (score: number) => {
  const angle = Math.PI * (1 - score / 100)
  return { x: CX + RADIUS * Math.cos(angle), y: CY - RADIUS * Math.sin(angle) }
}

const arc = (from: number, to: number) => {
  const start = point(from)
  const end = point(to)
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${RADIUS} ${RADIUS} 0 0 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`
}

function Bars({ rows }: { rows: Array<{ key: string; label: string; value: number; text: string }> }) {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setShown(true))
    return () => window.cancelAnimationFrame(frame)
  }, [])
  return (
    <div className="chart-bars">
      {rows.map((row, index) => (
        <div className="chart-bar" key={row.key}>
          <span className="chart-bar-label">{row.label}</span>
          <span className="chart-bar-track"><i style={{ width: shown ? `${Math.max(3, Math.min(100, row.value))}%` : '0%', transitionDelay: `${index * 90}ms` }} /></span>
          <strong className="chart-bar-value"><bdi dir="ltr">{row.text}</bdi></strong>
        </div>
      ))}
    </div>
  )
}

export default function RiskChart({ score, decision, breakdown, hazard }: { score: number; decision: string; breakdown: Record<string, number>; hazard: OfficialHazard | null | undefined }) {
  const { t, label } = usePreferences()
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setShown(true))
    return () => window.cancelAnimationFrame(frame)
  }, [])
  const clamped = Math.max(0, Math.min(100, score))
  const drivers = Object.entries(breakdown).filter(([, value]) => value > 0).sort((left, right) => right[1] - left[1])
  const peak = Math.max(1, ...drivers.map(([, value]) => value))
  const exposure: Array<{ key: string; label: string; value: number; text: string }> = []
  if (hazard) {
    if (hazard.seismic_zone && ZONES[hazard.seismic_zone]) exposure.push({ key: 'seismic', label: t('chart.seismic'), value: ZONES[hazard.seismic_zone], text: t('hz.zone', { zone: hazard.seismic_zone }) })
    exposure.push({ key: 'flood', label: t('chart.flood'), value: hazard.flood_area_pct, text: `${hazard.flood_area_pct}%` })
    if (hazard.cyclone_grade && GRADES[hazard.cyclone_grade]) exposure.push({ key: 'cyclone', label: t('chart.cyclone'), value: GRADES[hazard.cyclone_grade], text: hazard.cyclone_grade })
    if (hazard.landslide_rank) exposure.push({ key: 'landslide', label: t('chart.landslide'), value: ((148 - hazard.landslide_rank) / 147) * 100, text: t('hz.landslide_rank', { rank: hazard.landslide_rank }) })
  }
  const needle = shown ? -90 + clamped * 1.8 : -90

  return (
    <Card title={t('chart.title')} className="risk-chart-card">
      <div className="risk-chart">
        <figure className="chart-gauge">
          <svg viewBox="0 0 220 130" role="img" aria-label={`${t('res.score')}: ${t('score.of', { score: clamped })}, ${label('decision', decision)}`}>
            {BANDS.map((band) => <path key={band.tone} d={arc(band.from, band.to)} className={`gauge-band gauge-${band.tone}`} />)}
            <g className="gauge-needle" style={{ transform: `rotate(${needle}deg)`, transformOrigin: `${CX}px ${CY}px` }}>
              <line x1={CX} y1={CY} x2={CX} y2={CY - RADIUS + 12} />
              <circle cx={CX} cy={CY} r="7" />
            </g>
          </svg>
          <figcaption>
            <strong className="chart-score"><bdi dir="ltr">{t('score.of', { score: clamped })}</bdi></strong>
            <span>{label('decision', decision)}</span>
          </figcaption>
          <ul className="chart-legend">
            {BANDS.map((band) => <li key={band.tone}><i className={`gauge-${band.tone}`} />{label('decision', band.decision)} <bdi dir="ltr">{band.from}–{band.to}</bdi></li>)}
          </ul>
        </figure>
        <div className="chart-columns">
          <section>
            <h3>{t('chart.drivers')}</h3>
            {drivers.length ? <Bars rows={drivers.map(([key, value]) => ({ key, label: label('bd', key), value: (value / peak) * 100, text: `+${value}` }))} /> : <p className="muted-text">{t('chart.no_drivers')}</p>}
          </section>
          {exposure.length > 0 && (
            <section>
              <h3>{t('chart.exposure')}</h3>
              <Bars rows={exposure} />
            </section>
          )}
        </div>
      </div>
    </Card>
  )
}
