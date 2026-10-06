import { useEffect, useState } from 'react'
import Card from '@/components/shared/Card'
import { PageSkeleton } from '@/components/shared/Loader'
import SelectField from '@/components/shared/SelectField'
import PortfolioAnalytics from '@/components/dashboard/PortfolioAnalytics'
import { useRiskContext } from '@/context/RiskContext'
import { usePreferences } from '@/context/Preferences'
import { inrShort } from '@/lib/format'
import type { BackendHistoryRow, HistoryQuery } from '@/types/backend'

const DECISIONS = ['Accept', 'Refer', 'Decline (mitigation possible)', 'Auto-Decline']
const BANDS: Array<[string, string]> = [['Accept', '0–30'], ['Refer', '31–60'], ['Decline (mitigation possible)', '61–84'], ['Auto-Decline', '85–100']]

export default function Dashboard({ onNew, onView }: { onNew: () => void; onView: (item: BackendHistoryRow) => void }) {
  const { portfolio, rows, total, query, setQuery, loading, error, refresh } = useRiskContext()
  const { t, label } = usePreferences()
  const [search, setSearch] = useState(query.q)

  useEffect(() => {
    if (search === query.q) return
    const timer = window.setTimeout(() => setQuery({ q: search }), 300)
    return () => window.clearTimeout(timer)
  }, [search, query.q, setQuery])

  const from = total ? query.offset + 1 : 0
  const to = Math.min(query.offset + query.limit, total)

  return <div>
    <div className="page-subtitle">{t('dash.eyebrow')}</div>
    <div className="page-heading-row">
      <div>
        <h1 className="page-title">{t('dash.title')}</h1>
        <p className="page-lead">{t('dash.lead')}</p>
      </div>
      <button className="btn btn-primary" onClick={onNew}>{t('dash.new')}</button>
    </div>

    {error && <div className="error-banner">{error} <button className="btn btn-secondary" onClick={refresh}>{t('dash.retry')}</button></div>}
    {loading ? <PageSkeleton heading={false} /> : <>
      <div className="kpi-row">
        <div className="kpi"><div className="kpi-label">{t('kpi.submissions')}</div><div className="kpi-value">{portfolio?.submissions ?? 0}</div></div>
        <div className="kpi"><div className="kpi-label">{t('kpi.avg_score')}</div><div className="kpi-value"><bdi dir="ltr">{t('score.of', { score: portfolio?.average_score ?? 0 })}</bdi></div><div className="kpi-hint">{t('score.hint')}</div></div>
        <div className="kpi"><div className="kpi-label">{t('kpi.pending')}</div><div className="kpi-value">{portfolio?.pending_review ?? 0}</div></div>
        <div className="kpi"><div className="kpi-label">{t('kpi.sum_insured')}</div><div className="kpi-value"><bdi dir="ltr">{inrShort(portfolio?.total_value_inr ?? 0)}</bdi></div></div>
      </div>

      <div className="dashboard-grid">
        <Card title={t('card.mitigation')}>
          <div className="risk-stack">
            <div className="risk-line"><span>{t('mit.sprinklers')}</span><strong>{portfolio?.with_sprinklers ?? 0}</strong></div>
            <div className="risk-line"><span>{t('mit.fire_alarm')}</span><strong>{portfolio?.with_fire_alarm ?? 0}</strong></div>
            <div className="risk-line"><span>{t('mit.flood')}</span><strong>{portfolio?.with_flood_protection ?? 0}</strong></div>
            <div className="risk-line"><span>{t('mit.benefit')}</span><strong>{portfolio?.mitigation_benefit ?? 0}</strong></div>
          </div>
        </Card>
        <Card title={t('card.drivers')}>
          <div className="risk-stack">
            {portfolio?.top_drivers.length ? portfolio.top_drivers.map(([name, count]) => <div className="risk-line" key={name}><span>{label('flag', name)}</span><strong>{count}</strong></div>) : <p>{t('drivers.none')}</p>}
          </div>
          <p className="card-footnote">{t('drivers.note')}</p>
        </Card>
      </div>

      <div className="dashboard-grid">
        <Card title={t('card.decisions')}>
          <div className="risk-stack">{DECISIONS.map((name) => <div className="risk-line" key={name}><span>{label('decision', name)}</span><strong>{portfolio?.decisions[name] ?? 0}</strong></div>)}</div>
        </Card>
        <Card title={t('card.bands')}>
          <div className="risk-stack">{BANDS.map(([name, range]) => <div className="risk-line" key={name}><span>{range} · {label('decision', name)}</span><strong>{portfolio?.bands[name] ?? 0}</strong></div>)}</div>
        </Card>
      </div>

      <PortfolioAnalytics />

      <Card title={t('card.recent')}>
        <div className="table-toolbar">
          <label className="table-search"><span>{t('table.search')}</span><input placeholder={t('table.search_ph')} value={search} onChange={(event) => setSearch(event.target.value)} /></label>
          <SelectField className="table-filter" label={t('table.filter')} value={query.decision} onChange={(value) => setQuery({ decision: value })} options={[{ value: 'All', label: t('table.all') }, ...DECISIONS.map((name) => ({ value: name, label: label('decision', name) }))]} />
          <SelectField className="table-filter" label={t('table.sort')} value={query.sort} onChange={(value) => setQuery({ sort: value as HistoryQuery['sort'] })} options={(['created', 'property', 'location', 'score', 'value'] as const).map((key) => ({ value: key, label: t(`sort.${key}`) }))} />
          <button className="btn btn-secondary table-sort-button" type="button" onClick={() => setQuery({ direction: query.direction === 'desc' ? 'asc' : 'desc' })} aria-label={t('table.toggle_sort')}>{query.direction === 'desc' ? '↓' : '↑'}</button>
        </div>
        <div className="table-wrap">
          <table className="table-wide">
            <thead><tr><th>{t('col.property')}</th><th>{t('col.location')}</th><th>{t('col.score')}</th><th>{t('col.indicative')}</th><th>{t('col.decision')}</th><th>{t('col.flags')}</th><th><span className="sr-only">{t('table.view')}</span></th></tr></thead>
            <tbody>{rows.map((item) => <tr key={`${item.id}-${item.property_id}`}>
              <td><span className="truncate-cell" title={item.property_id}>{item.property_id}</span></td>
              <td>{String(item.raw_input?.city ?? '')}, {String(item.raw_input?.state ?? '')}</td>
              <td><strong>{item.risk_score}</strong></td>
              <td>{item.prototype_mitigation_model?.risk_adjusted_view ?? '—'}</td>
              <td><span className={`decision-pill decision-${item.final_decision ?? item.decision}`}>{label('decision', item.final_decision ?? item.decision)}</span>{item.review_status === 'pending_review' && <div className="muted-text">{t('table.awaiting')}</div>}{item.review_status === 'overridden' && <div className="muted-text">{t('table.overridden', { decision: label('decision', item.decision) })}</div>}</td>
              <td><div className="flag-chip-list">{item.risk_flags.length ? <>{item.risk_flags.slice(0, 2).map((flag) => <span className="flag-chip" key={flag} title={label('flag', flag)}>{label('flag', flag)}</span>)}{item.risk_flags.length > 2 && <span className="flag-chip flag-chip-more" title={item.risk_flags.slice(2).map((flag) => label('flag', flag)).join(', ')}>+{item.risk_flags.length - 2}</span>}</> : <span className="muted-text">{t('table.none')}</span>}</div></td>
              <td><button className="btn btn-secondary" onClick={() => onView(item)}>{t('table.view')}</button></td>
            </tr>)}</tbody>
          </table>
        </div>
        {rows.length === 0 && <p className="empty-state">{t(portfolio?.submissions ? 'table.no_match' : 'table.empty')}</p>}
        {total > query.limit && <div className="table-pager">
          <span className="muted-text">{t('table.range', { from, to, total })}</span>
          <button className="btn btn-secondary" type="button" disabled={query.offset === 0} onClick={() => setQuery({ offset: Math.max(0, query.offset - query.limit) })}>{t('table.prev')}</button>
          <button className="btn btn-secondary" type="button" disabled={to >= total} onClick={() => setQuery({ offset: query.offset + query.limit })}>{t('table.next')}</button>
        </div>}
      </Card>
    </>}
  </div>
}
