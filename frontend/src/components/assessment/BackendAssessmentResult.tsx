import React from 'react'
import Card from '@/components/shared/Card'
import type { BackendSubmission, StructuredMemo } from '@/types/backend'
import { downloadSubmissionReport } from '@/api/underwriting'
import ReviewPanel from '@/components/assessment/ReviewPanel'

const label = (value: string) => value
  .replaceAll('_', ' ')
  .replace(/\b\w/g, (letter) => letter.toUpperCase())

function renderMemo(memo: StructuredMemo) {
  const sections: Array<[string, string[]]> = [
    ['Property Summary', memo.property_summary],
    ['Key Risk Factors', memo.key_risk_factors],
    ['Coverage Review', memo.coverage_review ?? []],
    ['Decision', [memo.decision]],
    ['Rationale', [memo.rationale]],
    ['Suggested Next Steps', memo.suggested_next_steps],
  ]
  return sections.filter(([, lines]) => lines.length > 0).map(([heading, lines]) => <section key={heading} className="memo-section"><h3>{heading}</h3><ul>{lines.map((line, index) => <li key={index}>{line}</li>)}</ul></section>)
}

export default function BackendAssessmentResult({ submission, onBack, onReviewed }: { submission: BackendSubmission; onBack: () => void; onReviewed: (updated: BackendSubmission) => void }) {
  const cited = new Set(submission.memo_json?.guideline_citations ?? [])
  const features = submission.extracted_features ?? {}
  const mitigation = submission.prototype_mitigation_model
  const displayPolicyType = (submission.policy_type ?? 'Not supplied').replace('/', ' / ')
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
      link.download = `underwriting-${submission.id}.pdf`
      link.click()
      URL.revokeObjectURL(url)
    } catch (cause) {
      setReportError(cause instanceof Error ? cause.message : 'Report generation unavailable')
    } finally {
      setReportBusy(false)
    }
  }

  return <div>
    <button className="btn btn-secondary" onClick={onBack}>Back to Portfolio</button>
    <button className="btn btn-primary" onClick={() => void downloadReport()} disabled={reportBusy} style={{ marginLeft: 8 }}>{reportBusy ? 'Generating report...' : 'Download executive PDF'}</button>
    {reportError && <div className="error-banner">Report generation unavailable: {reportError} <button className="btn btn-secondary" onClick={() => void downloadReport()}>Retry</button></div>}
    <div className="page-subtitle">Property Risk Assessment</div>
    <h1 className="page-title">{submission.property_id}</h1>
    <div className="kpi-row">
      <div className="kpi"><div className="kpi-label">Risk score</div><div className="kpi-value">{submission.risk_score}</div></div>
      <div className="kpi"><div className="kpi-label">Indicative view</div><div className="kpi-value">{mitigation?.risk_adjusted_view ?? 'Not available'}</div></div>
      <div className="kpi"><div className="kpi-label">{submission.review_status === 'pending_review' ? 'Decision (awaiting review)' : 'Decision'}</div><div className="kpi-value">{submission.final_decision ?? submission.decision}</div></div>
      <div className="kpi"><div className="kpi-label">Policy segment</div><div className="kpi-value">{displayPolicyType}</div></div>
    </div>
    <ReviewPanel submission={submission} onReviewed={onReviewed} />
    <div className="dashboard-grid">
      <Card title="Decision and risk flags">
        <p>{submission.rationale}</p>
        <div className="flag-list">{submission.risk_flags.length ? submission.risk_flags.map((flag) => <span className="risk-badge risk-high" key={flag}>{label(flag)}</span>) : <span>No risk flags recorded.</span>}</div>
      </Card>
      <Card title="Image review">
        <p>Status: {String(features.image_status ?? 'Not submitted')}</p>
        <p>Reason: {String(features.image_reason ?? 'No image metadata')}</p>
        <p>Image-derived evidence: {features.image_risk_evidence_used ? 'Used' : 'Not used'}</p>
        <p>Roof: {String(features.visible_roof_condition ?? 'not visible')}</p>
        <p>Structure: {String(features.visible_structural_damage ?? 'not visible')}</p>
        <p>Maintenance: {String(features.general_maintenance_level ?? 'not visible')}</p>
        <p>Hazards: {String(features.visible_hazards ?? 'not visible')}</p>
      </Card>
    </div>
    <div className="dashboard-grid">
      <Card title="Risk breakdown">
        <div className="metric-grid">{Object.entries(submission.risk_breakdown).map(([key, value]) => <div className="mini-metric" key={key}><span>{label(key)}</span><strong>{value}</strong></div>)}</div>
      </Card>
      <Card title="Configured mitigation factors">
        <p className="card-footnote">Configured mitigation benefit — a proxy for protection effectiveness, not the actual indicative score reduction. Not insurer-approved rates or tariff rules.</p>
        {mitigation?.mitigation_benefits.filter((item) => item.benefit > 0).map((item) => <div className="risk-line" key={item.factor}><span>{label(item.factor)}</span><strong>+{item.benefit}</strong></div>)}
        {!mitigation?.mitigation_benefits.some((item) => item.benefit > 0) && <p>No positive mitigation evidence returned.</p>}
      </Card>
    </div>
    <Card title="AI-Assisted Underwriting memo">
      <p>
        Status: {submission.ai_memo_status ?? (submission.memo_json ? 'Available' : 'Unavailable')}
        {submission.memo_model ? ` · ${submission.memo_model}` : ''}
        {submission.trace_url && <> · <a href={submission.trace_url} target="_blank" rel="noreferrer">View AI trace</a></>}
      </p>
      {cited.size > 0 && <p className="card-footnote">Grounded in guideline sections {[...cited].join(', ')}, validated against what was retrieved.</p>}
      {submission.ai_memo_status !== 'Available' || !submission.memo_json ? <p>Reason: {submission.ai_memo_reason ?? 'AI review did not complete'}</p> : <div className="memo-content">{renderMemo(submission.memo_json)}</div>}
    </Card>
    <div className="dashboard-grid">
      <Card title="Guideline evidence (RAG)"><ul>{submission.guideline_chunks.map((chunk, index) => {
        const id = chunk.match(/^\[(G\d+)\]/)?.[1]
        return <li key={index} style={id && cited.has(id) ? { fontWeight: 600 } : undefined}>{chunk}{id && cited.has(id) ? ' (cited)' : ''}</li>
      })}</ul></Card>
      <Card title="Reference properties"><div className="table-wrap"><table><thead><tr><th>Property</th><th>Occupancy</th><th>CAT zone</th></tr></thead><tbody>{submission.comparables.map((item, index) => <tr key={index}><td>{String(item.property_id ?? '')}</td><td>{String(item.occupancy_type ?? '')}</td><td>{String(item.cat_zone ?? '')}</td></tr>)}</tbody></table></div><p className="card-footnote">Reference data — synthetic model properties, not verified market comparables.</p></Card>
    </div>
  </div>
}
