import { useMemo, useState } from 'react'
import Card from '@/components/shared/Card'
import PortfolioAnalytics from '@/components/dashboard/PortfolioAnalytics'
import { useRiskContext } from '@/context/RiskContext'
import { usePreferences } from '@/context/Preferences'
import { inrShort } from '@/lib/format'
import type { BackendHistoryRow } from '@/types/backend'

const DECISIONS = ['Accept', 'Refer', 'Decline (mitigation possible)', 'Auto-Decline']

export default function Dashboard({ onNew, onView }: { onNew: () => void; onView: (item: BackendHistoryRow) => void }) {
  const { submissions, loading, error, refresh } = useRiskContext()
  const { t, label } = usePreferences()
  const [query, setQuery] = useState('')
  const [decision, setDecision] = useState('All')
  const [sortKey, setSortKey] = useState<'created' | 'property' | 'location' | 'score' | 'value'>('created')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  const filtered = useMemo(() => submissions.filter((item) => {
    const haystack = `${item.property_id} ${item.raw_input?.address ?? ''} ${item.raw_input?.city ?? ''}`.toLowerCase()
    return haystack.includes(query.toLowerCase()) && (decision === 'All' || item.decision === decision)
  }).sort((left, right) => {
    const direction = sortDirection === 'asc' ? 1 : -1
    const leftLocation = `${left.raw_input?.city ?? ''} ${left.raw_input?.state ?? ''}`
    const rightLocation = `${right.raw_input?.city ?? ''} ${right.raw_input?.state ?? ''}`
    const leftValue = Number(left.total_value_at_risk_inr ?? left.raw_input?.tiv ?? 0)
    const rightValue = Number(right.total_value_at_risk_inr ?? right.raw_input?.tiv ?? 0)
    switch (sortKey) {
      case 'property':
        return left.property_id.localeCompare(right.property_id) * direction
      case 'location':
        return leftLocation.localeCompare(rightLocation) * direction
      case 'score':
        return (left.risk_score - right.risk_score) * direction
      case 'value':
        return (leftValue - rightValue) * direction
      default:
        return (new Date(left.created_at ?? 0).getTime() - new Date(right.created_at ?? 0).getTime()) * direction
    }
  }), [submissions, query, decision, sortKey, sortDirection])

  const counts = submissions.reduce((acc, item) => {
    acc[item.decision] = (acc[item.decision] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  const average = submissions.length ? Math.round(submissions.reduce((sum, item) => sum + item.risk_score, 0) / submissions.length) : 0
  const pendingReview = submissions.filter((item) => item.review_status === 'pending_review').length
  const totalValue = submissions.reduce((sum, item) => sum + Number(item.total_value_at_risk_inr ?? item.raw_input?.tiv ?? 0), 0)
  const withSprinklers = submissions.filter((item) => String(item.raw_input?.sprinkler_system).toUpperCase() === 'Y').length
  const withFireAlarm = submissions.filter((item) => item.raw_input?.fire_alarm === true).length
  const withFloodProtection = submissions.filter((item) => item.raw_input?.flood_protection === true).length
  const mitigationContribution = submissions.reduce((sum, item) => sum + Number(item.prototype_mitigation_model?.mitigation_benefit ?? 0), 0)
  const topDrivers = Object.entries(submissions.reduce((acc, item) => {
    item.risk_flags.forEach((flag) => { acc[flag] = (acc[flag] || 0) + 1 })
    return acc
  }, {} as Record<string, number>)).sort(([, left], [, right]) => right - left).slice(0, 5)
  const bands: Array<[string, string, number]> = [
    ['Accept', '0–30', submissions.filter((item) => item.risk_score <= 30).length],
    ['Refer', '31–60', submissions.filter((item) => item.risk_score >= 31 && item.risk_score <= 60).length],
    ['Decline (mitigation possible)', '61–84', submissions.filter((item) => item.risk_score >= 61 && item.risk_score <= 84).length],
    ['Auto-Decline', '85–100', submissions.filter((item) => item.risk_score >= 85).length],
  ]

  return <div>
    <div className="page-subtitle">{t('dash.eyebrow')}</div>
    <div className="page-heading-row">
      <div>
        <h1 className="page-title">{t('dash.title')}</h1>
        <p className="page-lead">{t('dash.lead')}</p>
      </div>
      <button className="btn btn-primary" onClick={onNew}>{t('dash.new')}</button>
    </div>

    {error && <div className="error-banner">{error} <button className="btn btn-secondary" onClick={() => void refresh()}>{t('dash.retry')}</button></div>}
    {loading ? <Card><p>{t('dash.loading')}</p></Card> : <>
      <div className="kpi-row">
        <div className="kpi"><div className="kpi-label">{t('kpi.submissions')}</div><div className="kpi-value">{submissions.length}</div></div>
        <div className="kpi"><div className="kpi-label">{t('kpi.avg_score')}</div><div className="kpi-value"><bdi dir="ltr">{t('score.of', { score: average })}</bdi></div><div className="kpi-hint">{t('score.hint')}</div></div>
        <div className="kpi"><div className="kpi-label">{t('kpi.pending')}</div><div className="kpi-value">{pendingReview}</div></div>
        <div className="kpi"><div className="kpi-label">{t('kpi.sum_insured')}</div><div className="kpi-value"><bdi dir="ltr">{inrShort(totalValue)}</bdi></div></div>
      </div>

      <div className="dashboard-grid">
        <Card title={t('card.mitigation')}>
          <div className="risk-stack">
            <div className="risk-line"><span>{t('mit.sprinklers')}</span><strong>{withSprinklers}</strong></div>
            <div className="risk-line"><span>{t('mit.fire_alarm')}</span><strong>{withFireAlarm}</strong></div>
            <div className="risk-line"><span>{t('mit.flood')}</span><strong>{withFloodProtection}</strong></div>
            <div className="risk-line"><span>{t('mit.benefit')}</span><strong>{mitigationContribution}</strong></div>
          </div>
        </Card>
        <Card title={t('card.drivers')}>
          <div className="risk-stack">
            {topDrivers.length ? topDrivers.map(([name, count]) => <div className="risk-line" key={name}><span>{label('flag', name)}</span><strong>{count}</strong></div>) : <p>{t('drivers.none')}</p>}
          </div>
          <p className="card-footnote">{t('drivers.note')}</p>
        </Card>
      </div>

      <div className="dashboard-grid">
        <Card title={t('card.decisions')}>
          <div className="risk-stack">{DECISIONS.map((name) => <div className="risk-line" key={name}><span>{label('decision', name)}</span><strong>{counts[name] || 0}</strong></div>)}</div>
        </Card>
        <Card title={t('card.bands')}>
          <div className="risk-stack">{bands.map(([name, range, value]) => <div className="risk-line" key={name}><span>{range} · {label('decision', name)}</span><strong>{value}</strong></div>)}</div>
        </Card>
      </div>

      <PortfolioAnalytics />

      <Card title={t('card.recent')}>
        <div className="table-toolbar">
          <label className="table-search"><span>{t('table.search')}</span><input placeholder={t('table.search_ph')} value={query} onChange={(event) => setQuery(event.target.value)} /></label>
          <label className="table-filter"><span>{t('table.filter')}</span><select value={decision} onChange={(event) => setDecision(event.target.value)}><option value="All">{t('table.all')}</option>{DECISIONS.map((name) => <option key={name} value={name}>{label('decision', name)}</option>)}</select></label>
          <label className="table-filter"><span>{t('table.sort')}</span><select value={sortKey} onChange={(event) => setSortKey(event.target.value as typeof sortKey)}>{(['created', 'property', 'location', 'score', 'value'] as const).map((key) => <option key={key} value={key}>{t(`sort.${key}`)}</option>)}</select></label>
          <button className="btn btn-secondary table-sort-button" type="button" onClick={() => setSortDirection((current) => current === 'desc' ? 'asc' : 'desc')} aria-label={t('table.toggle_sort')}>{sortDirection === 'desc' ? '↓' : '↑'}</button>
        </div>
        <div className="table-wrap">
          <table className="table-wide">
            <thead><tr><th>{t('col.property')}</th><th>{t('col.location')}</th><th>{t('col.score')}</th><th>{t('col.indicative')}</th><th>{t('col.decision')}</th><th>{t('col.flags')}</th><th /></tr></thead>
            <tbody>{filtered.map((item) => <tr key={`${item.id}-${item.property_id}`}>
              <td><span className="truncate-cell" title={item.property_id}>{item.property_id}</span></td>
              <td>{String(item.raw_input?.city ?? '')}, {String(item.raw_input?.state ?? '')}</td>
              <td><strong>{item.risk_score}</strong></td>
              <td>{item.prototype_mitigation_model?.risk_adjusted_view ?? '—'}</td>
              <td><span className={`decision-pill decision-${item.final_decision ?? item.decision}`}>{label('decision', item.final_decision ?? item.decision)}</span>{item.review_status === 'pending_review' && <div className="muted-text">{t('table.awaiting')}</div>}{item.review_status === 'overridden' && <div className="muted-text">{t('table.overridden', { decision: label('decision', item.decision) })}</div>}</td>
              <td><div className="flag-chip-list">{item.risk_flags.length ? item.risk_flags.map((flag) => <span className="flag-chip" key={flag}>{label('flag', flag)}</span>) : <span className="muted-text">{t('table.none')}</span>}</div></td>
              <td><button className="btn btn-secondary" onClick={() => onView(item)}>{t('table.view')}</button></td>
            </tr>)}</tbody>
          </table>
        </div>
        {filtered.length === 0 && <p className="empty-state">{t(submissions.length ? 'table.no_match' : 'table.empty')}</p>}
      </Card>
    </>}
  </div>
}
