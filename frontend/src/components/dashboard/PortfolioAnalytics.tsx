import { useEffect, useState } from 'react'
import Card from '@/components/shared/Card'
import { fetchAnalytics } from '@/api/underwriting'
import type { AnalyticsSnapshot } from '@/types/backend'

const crore = (value: unknown) => `₹${(Number(value || 0) / 1e7).toLocaleString('en-IN', { maximumFractionDigits: 0 })} Cr`

export default function PortfolioAnalytics() {
  const [snapshot, setSnapshot] = useState<AnalyticsSnapshot | null>(null)

  useEffect(() => {
    fetchAnalytics().then(setSnapshot).catch(() => setSnapshot(null))
  }, [])

  if (!snapshot) return null
  const { mart_cat_exposure: cat, mart_city_accumulation: cities } = snapshot.marts

  return (
    <>
      <Card title="CAT exposure (dbt mart)">
        <div className="table-wrap">
          <table>
            <thead><tr><th>CAT zone</th><th>Assessments</th><th>Insured value</th><th>Avg score</th><th>Declined</th></tr></thead>
            <tbody>{cat.map((row) => (
              <tr key={String(row.cat_zone)}><td>{String(row.cat_zone)}</td><td>{String(row.assessments)}</td><td>{crore(row.tiv_inr)}</td><td>{String(row.avg_risk_score)}</td><td>{String(row.decline_pct)}%</td></tr>
            ))}</tbody>
          </table>
        </div>
      </Card>
      <Card title="City accumulation (dbt mart)">
        <div className="table-wrap">
          <table>
            <thead><tr><th>#</th><th>City</th><th>Insured value</th><th>Portfolio share</th><th>Max score</th></tr></thead>
            <tbody>{cities.map((row) => (
              <tr key={`${row.city}-${row.state}`}><td>{String(row.accumulation_rank)}</td><td>{String(row.city)}, {String(row.state)}</td><td>{crore(row.tiv_inr)}</td><td>{String(row.portfolio_share_pct)}%</td><td>{String(row.max_risk_score)}</td></tr>
            ))}</tbody>
          </table>
        </div>
        <p className="card-footnote">Built nightly by the ELT pipeline: Postgres → Parquet → dbt on DuckDB (tested) → snapshot. Last run {snapshot.generated_at.slice(0, 16).replace('T', ' ')} UTC.</p>
      </Card>
    </>
  )
}
