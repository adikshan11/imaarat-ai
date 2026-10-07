import { useEffect, useState } from 'react'
import Card from '@/components/shared/Card'
import { fetchAnalytics } from '@/api/underwriting'
import { usePreferences } from '@/context/Preferences'
import { inrShort } from '@/lib/format'
import type { AnalyticsSnapshot } from '@/types/backend'

export default function PortfolioAnalytics() {
  const { t, label, dev } = usePreferences()
  const [snapshot, setSnapshot] = useState<AnalyticsSnapshot | null>(null)

  useEffect(() => {
    fetchAnalytics().then(setSnapshot).catch(() => setSnapshot(null))
  }, [])

  if (!snapshot) return null
  const { mart_cat_exposure: cat, mart_city_accumulation: cities } = snapshot.marts
  const time = snapshot.generated_at.slice(0, 16).replace('T', ' ')

  return (
    <>
      <Card title={t(dev ? 'cat.title_dev' : 'cat.title')}>
        <div className="table-wrap">
          <table>
            <thead><tr><th>{t('cat.zone')}</th><th>{t('cat.assessments')}</th><th>{t('cat.sum_insured')}</th><th>{t('cat.avg')}</th><th>{t('cat.declined')}</th></tr></thead>
            <tbody>{cat.map((row) => (
              <tr key={String(row.cat_zone)}><td>{label('opt.cat', String(row.cat_zone))}</td><td>{String(row.assessments)}</td><td><bdi dir="ltr">{inrShort(row.tiv_inr)}</bdi></td><td>{String(row.avg_risk_score)}</td><td><bdi dir="ltr">{String(row.decline_pct)}%</bdi></td></tr>
            ))}</tbody>
          </table>
        </div>
      </Card>
      <Card title={t(dev ? 'city.title_dev' : 'city.title')}>
        <div className="table-wrap">
          <table>
            <thead><tr><th>#</th><th>{t('city.city')}</th><th>{t('cat.sum_insured')}</th><th>{t('city.share')}</th><th>{t('city.max')}</th></tr></thead>
            <tbody>{cities.map((row) => (
              <tr key={`${row.city}-${row.state}`}><td>{String(row.accumulation_rank)}</td><td>{String(row.city)}, {String(row.state)}</td><td><bdi dir="ltr">{inrShort(row.tiv_inr)}</bdi></td><td><bdi dir="ltr">{String(row.portfolio_share_pct)}%</bdi></td><td>{String(row.max_risk_score)}</td></tr>
            ))}</tbody>
          </table>
        </div>
        <p className="card-footnote">{t(dev ? 'pipeline.note_dev' : 'pipeline.note', { time })}</p>
      </Card>
    </>
  )
}
