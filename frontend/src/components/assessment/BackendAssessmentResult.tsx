import React from 'react'
import Card from '@/components/shared/Card'
import type { BackendSubmission, StructuredMemo } from '@/types/backend'
import { downloadSubmissionReport } from '@/api/underwriting'
import { usePreferences } from '@/context/Preferences'
import ReviewPanel from '@/components/assessment/ReviewPanel'
import HazardCard from '@/components/assessment/HazardCard'
import type { OfficialHazard } from '@/types/backend'

function Memo({ memo }: { memo: StructuredMemo }) {
  const { t } = usePreferences()
  const sections: Array<[string, string[]]> = [
    ['memo.summary', memo.property_summary],
    ['memo.factors', memo.key_risk_factors],
    ['memo.coverage', memo.coverage_review ?? []],
    ['memo.decision', [memo.decision]],
    ['memo.rationale', [memo.rationale]],
    ['memo.next', memo.suggested_next_steps],
  ]
  return <div className="memo-content">{sections.filter(([, lines]) => lines.length > 0).map(([key, lines]) => <section key={key} className="memo-section"><h3>{t(key)}</h3><ul>{lines.map((line, index) => <li key={index}>{line}</li>)}</ul></section>)}</div>
}

export default function BackendAssessmentResult({ submission, onBack, onReviewed }: { submission: BackendSubmission; onBack: () => void; onReviewed: (updated: BackendSubmission) => void }) {
  const { t, label, dev } = usePreferences()
  const cited = new Set(submission.memo_json?.guideline_citations ?? [])
  const features = submission.extracted_features ?? {}
  const mitigation = submission.prototype_mitigation_model
  const decision = submission.final_decision ?? submission.decision
  const segment = submission.policy_type ? submission.policy_type.replace('/', ' / ') : t('res.not_supplied')
  const seen = (key: string) => String(features[key] ?? t('img.not_visible'))
  const [reportError, setReportError] = React.useState<string | null>(null)
  const [reportBusy, setReportBusy] = React.useState(false)
  const downloadReport = async () => {
    if (!submission.id) return
    setReportBusy(true)
    setReportError(null)
    try {
      const blob = await downloadSubmissionReport(submission.id)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `imaarat-${submission.id}.pdf`
      link.click()
      URL.revokeObjectURL(url)
    } catch (cause) {
      setReportError(cause instanceof Error ? cause.message : t('res.not_available'))
    } finally {
      setReportBusy(false)
    }
  }
  const hits = submission.guideline_hits ?? []

  return <div>
    <div className="action-row">
      <button className="btn btn-secondary" onClick={onBack}>{t('res.back')}</button>
      <button className="btn btn-primary" onClick={() => void downloadReport()} disabled={reportBusy}>{reportBusy ? t('res.pdf_busy') : t('res.pdf')}</button>
    </div>
    {reportError && <div className="error-banner">{t('res.pdf_error', { error: reportError })} <button className="btn btn-secondary" onClick={() => void downloadReport()}>{t('res.retry')}</button></div>}
    <div className="page-subtitle">{t('res.eyebrow')}</div>
    <h1 className="page-title">{submission.property_id}</h1>
    <div className="kpi-row">
      <div className="kpi"><div className="kpi-label">{t('res.score')}</div><div className="kpi-value"><bdi dir="ltr">{t('score.of', { score: submission.risk_score })}</bdi></div><div className="kpi-hint">{t('score.hint')}</div></div>
      <div className="kpi"><div className="kpi-label">{t(submission.review_status === 'pending_review' ? 'res.decision_pending' : 'res.decision')}</div><div className="kpi-value">{label('decision', decision)}</div><div className="kpi-hint">{t(`decision_help.${decision}`)}</div></div>
      <div className="kpi"><div className="kpi-label">{t('res.indicative')}</div><div className="kpi-value">{mitigation?.risk_adjusted_view ?? t('res.not_available')}</div></div>
      <div className="kpi"><div className="kpi-label">{t('res.segment')}</div><div className="kpi-value kpi-value-text">{segment}</div></div>
    </div>
    <ReviewPanel submission={submission} onReviewed={onReviewed} />
    <HazardCard hazard={features.official_hazard as OfficialHazard | null | undefined} declaredZone={String(features.seismic_zone_declared ?? submission.raw_input?.seismic_zone ?? '')} />
    <div className="dashboard-grid">
      <Card title={t('res.flags_title')}>
        <p>{submission.rationale}</p>
        <div className="flag-list">{submission.risk_flags.length ? submission.risk_flags.map((flag) => <span className="risk-badge risk-high" key={flag}>{label('flag', flag)}</span>) : <span>{t('res.no_flags')}</span>}</div>
      </Card>
      <Card title={t('res.image_title')}>
        <div className="risk-stack">
          <div className="risk-line"><span>{t('img.status')}</span><strong>{String(features.image_status ?? t('img.not_submitted'))}</strong></div>
          {dev && <div className="risk-line"><span>{t('img.reason')}</span><strong>{String(features.image_reason ?? t('img.no_meta'))}</strong></div>}
          <div className="risk-line"><span>{t('img.evidence')}</span><strong>{t(features.image_risk_evidence_used ? 'img.used' : 'img.not_used')}</strong></div>
          <div className="risk-line"><span>{t('img.roof')}</span><strong>{seen('visible_roof_condition')}</strong></div>
          <div className="risk-line"><span>{t('img.structure')}</span><strong>{seen('visible_structural_damage')}</strong></div>
          <div className="risk-line"><span>{t('img.maintenance')}</span><strong>{seen('general_maintenance_level')}</strong></div>
          <div className="risk-line"><span>{t('img.hazards')}</span><strong>{seen('visible_hazards')}</strong></div>
        </div>
      </Card>
    </div>
    <div className="dashboard-grid">
      <Card title={t('res.breakdown')}>
        <div className="metric-grid">{Object.entries(submission.risk_breakdown).filter(([, value]) => dev || value > 0).map(([key, value]) => <div className="mini-metric" key={key}><span>{label('bd', key)}</span><strong>{value}</strong></div>)}</div>
      </Card>
      <Card title={t('res.mitigation_title')}>
        <p className="card-footnote">{t('res.mitigation_note')}</p>
        {mitigation?.mitigation_benefits.filter((item) => item.benefit > 0).map((item) => <div className="risk-line" key={item.factor}><span>{label('factor', item.factor)}</span><strong>+{item.benefit}</strong></div>)}
        {!mitigation?.mitigation_benefits.some((item) => item.benefit > 0) && <p>{t('res.no_mitigation')}</p>}
      </Card>
    </div>
    <Card title={t('res.memo_title')}>
      <p className="card-footnote">
        {t('res.memo_ai_label')}
        {dev && submission.memo_model && <> · {t('res.memo_model', { model: submission.memo_model })}</>}
        {dev && submission.trace_url && <> · <a href={submission.trace_url} target="_blank" rel="noreferrer">{t('res.trace')}</a></>}
      </p>
      {cited.size > 0 && <p className="card-footnote">{t('res.cited', { ids: [...cited].join(', ') })}</p>}
      {submission.ai_memo_status !== 'Available' || !submission.memo_json ? <p>{t('res.memo_reason', { reason: submission.ai_memo_reason ?? t('res.not_available') })}</p> : <Memo memo={submission.memo_json} />}
    </Card>
    <div className="dashboard-grid">
      <Card title={t(dev ? 'res.guidelines_dev' : 'res.guidelines')}>
        {dev || !hits.length
          ? <ul>{submission.guideline_chunks.map((chunk, index) => {
              const id = chunk.match(/^\[(G\d+)\]/)?.[1]
              return <li key={index} className={id && cited.has(id) ? 'cited' : undefined}>{chunk}{id && cited.has(id) ? ` (${t('res.cited_tag')})` : ''}</li>
            })}</ul>
          : <ul>{hits.map((hit) => <li key={hit.id} className={cited.has(hit.id) ? 'cited' : undefined}>{hit.id} · {hit.title}{cited.has(hit.id) ? ` (${t('res.cited_tag')})` : ''}</li>)}</ul>}
      </Card>
      <Card title={t('res.refs')}><div className="table-wrap"><table><thead><tr><th>{t('ref.property')}</th><th>{t('ref.occupancy')}</th><th>{t('ref.cat')}</th></tr></thead><tbody>{submission.comparables.map((item, index) => <tr key={index}><td>{String(item.property_id ?? '')}</td><td>{String(item.occupancy_type ?? '')}</td><td>{label('opt.cat', String(item.cat_zone ?? 'None'))}</td></tr>)}</tbody></table></div><p className="card-footnote">{t('res.refs_note')}</p></Card>
    </div>
  </div>
}
