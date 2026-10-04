import { useMemo, useState } from 'react'
import Card from '@/components/shared/Card'
import PortfolioAnalytics from '@/components/dashboard/PortfolioAnalytics'
import { useRiskContext } from '@/context/RiskContext'
import type { BackendHistoryRow } from '@/types/backend'

const money = (value: unknown) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
}).format(Number(value || 0))
const label = (value: string) => value
  .replaceAll('_', ' ')
  .replace(/\b\w/g, (letter) => letter.toUpperCase())

export default function Dashboard({ onNew, onView }: { onNew: () => void; onView: (item: BackendHistoryRow) => void }) {
  const { submissions, loading, error, refresh } = useRiskContext()
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
  const bands = [
    ['Accept', submissions.filter((item) => item.risk_score <= 30).length],
    ['Refer', submissions.filter((item) => item.risk_score >= 31 && item.risk_score <= 60).length],
    ['Decline', submissions.filter((item) => item.risk_score >= 61 && item.risk_score <= 84).length],
    ['Auto-Decline', submissions.filter((item) => item.risk_score >= 85).length],
  ]

  return <div>
    <div className="page-subtitle">Portfolio Intelligence</div>
    <div className="page-heading-row">
      <div>
        <h1 className="page-title">Underwriting Dashboard</h1>
        <p className="page-lead">Commercial Property Risk & Portfolio Overview</p>
      </div>
      <button className="btn btn-primary" onClick={onNew}>New assessment</button>
    </div>

    {error && <div className="error-banner">{error} <button className="btn btn-secondary" onClick={() => void refresh()}>Retry</button></div>}
    {loading ? <Card><p>Loading underwriting history...</p></Card> : <>
      <div className="kpi-row">
        <div className="kpi"><div className="kpi-label">Submissions</div><div className="kpi-value">{submissions.length}</div></div>
        <div className="kpi"><div className="kpi-label">Average risk score</div><div className="kpi-value">{average}</div></div>
        <div className="kpi"><div className="kpi-label">Awaiting underwriter review</div><div className="kpi-value">{pendingReview}</div></div>
        <div className="kpi"><div className="kpi-label">Total value at risk</div><div className="kpi-value">{money(totalValue)}</div></div>
      </div>

      <div className="dashboard-grid">
        <Card title="Mitigation adoption">
          <div className="risk-stack">
            <div className="risk-line"><span>Properties with sprinklers</span><strong>{withSprinklers}</strong></div>
            <div className="risk-line"><span>Properties with fire alarms</span><strong>{withFireAlarm}</strong></div>
            <div className="risk-line"><span>Properties with flood protection</span><strong>{withFloodProtection}</strong></div>
            <div className="risk-line"><span>Configured mitigation benefit</span><strong>{mitigationContribution}</strong></div>
          </div>
        </Card>
        <Card title="Top Risk Drivers">
          <div className="risk-stack">
            {topDrivers.length ? topDrivers.map(([name, count]) => <div className="risk-line" key={name}><span>{label(name)}</span><strong>{count}</strong></div>) : <p>No risk drivers recorded yet.</p>}
          </div>
          <p className="card-footnote">Flags reflect portfolio conditions identified during assessment review.</p>
        </Card>
      </div>

      <div className="dashboard-grid">
        <Card title="Decision Distribution">
          <div className="risk-stack">{['Accept', 'Refer', 'Decline (mitigation possible)', 'Auto-Decline'].map((name) => <div className="risk-line" key={name}><span>{name}</span><strong>{counts[name] || 0}</strong></div>)}</div>
        </Card>
        <Card title="Risk Score Bands">
          <div className="risk-stack">{bands.map(([name, value]) => <div className="risk-line" key={name}><span>{name}</span><strong>{value}</strong></div>)}</div>
        </Card>
      </div>

      <PortfolioAnalytics />

      <Card title="Recent assessments">
        <div className="table-toolbar">
          <label className="table-search"><span>Search</span><input placeholder="Property or location" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
          <label className="table-filter"><span>Filter</span><select value={decision} onChange={(event) => setDecision(event.target.value)}><option>All</option><option>Accept</option><option>Refer</option><option>Decline (mitigation possible)</option><option>Auto-Decline</option></select></label>
          <label className="table-filter"><span>Sort</span><select value={sortKey} onChange={(event) => setSortKey(event.target.value as typeof sortKey)}><option value="created">Newest</option><option value="property">Property</option><option value="location">Location</option><option value="score">Score</option><option value="value">Value</option></select></label>
          <button className="btn btn-secondary table-sort-button" type="button" onClick={() => setSortDirection((current) => current === 'desc' ? 'asc' : 'desc')} aria-label="Toggle sort direction">{sortDirection === 'desc' ? '↓' : '↑'}</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Property</th><th>Location</th><th>Score</th><th>Indicative</th><th>Decision</th><th>Flags</th><th /></tr></thead>
            <tbody>{filtered.map((item) => <tr key={`${item.id}-${item.property_id}`}>
              <td><span className="truncate-cell" title={item.property_id}>{item.property_id}</span></td>
              <td>{String(item.raw_input?.city ?? '')}, {String(item.raw_input?.state ?? '')}</td>
              <td><strong>{item.risk_score}</strong></td>
              <td>{item.prototype_mitigation_model?.risk_adjusted_view ?? '—'}</td>
              <td><span className={`decision-pill decision-${item.final_decision ?? item.decision}`}>{item.final_decision ?? item.decision}</span>{item.review_status === 'pending_review' && <div className="muted-text">awaiting review</div>}{item.review_status === 'overridden' && <div className="muted-text">overridden from {item.decision}</div>}</td>
              <td><div className="flag-chip-list">{item.risk_flags.length ? item.risk_flags.map((flag) => <span className="flag-chip" key={flag}>{label(flag)}</span>) : <span className="muted-text">None</span>}</div></td>
              <td><button className="btn btn-secondary" onClick={() => onView(item)}>View</button></td>
            </tr>)}</tbody>
          </table>
        </div>
        {filtered.length === 0 && <p className="empty-state">{submissions.length ? 'No matching assessments.' : 'No assessments yet.'}</p>}
      </Card>
    </>}
  </div>
}
