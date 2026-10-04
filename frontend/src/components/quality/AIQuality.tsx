import { useEffect, useState } from 'react'
import Card from '@/components/shared/Card'
import { fetchEvals } from '@/api/underwriting'
import { usePreferences } from '@/context/Preferences'
import type { EvalReport, FormatSummary } from '@/types/backend'

const pct = (value: number | null | undefined) => (value === null || value === undefined ? 'n/a' : `${Math.round(value * 100)}%`)
const num = (value: number | null | undefined, digits = 0) => (value === null || value === undefined ? 'n/a' : value.toLocaleString('en-IN', { maximumFractionDigits: digits }))

function FormatRow({ name, summary }: { name: string; summary: FormatSummary }) {
  return (
    <tr>
      <td><strong>{name}</strong></td>
      <td>{summary.memos}</td>
      <td>{pct(summary.contract_pass_rate)}</td>
      <td>{num(summary.faithfulness, 2)}</td>
      <td>{pct(summary.citation_precision)}</td>
      <td>{num(summary.avg_input_tokens)}</td>
      <td>{num(summary.avg_latency_ms)}</td>
    </tr>
  )
}

export default function AIQuality() {
  const { t } = usePreferences()
  const [report, setReport] = useState<EvalReport | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchEvals().then(setReport).catch((cause) => setError(cause instanceof Error ? cause.message : 'Evaluation report unavailable'))
  }, [])

  return (
    <div>
      <div className="page-subtitle">{t('q.eyebrow')}</div>
      <h1 className="page-title">{t('q.title')}</h1>
      <p className="page-lead">{t('q.lead', { cases: report?.deterministic.cases ?? 24 })}</p>
      {error && <div className="error-banner">{error}</div>}
      {report && (
        <>
          <div className="kpi-row">
            <div className="kpi"><div className="kpi-label">{t('q.accuracy')}</div><div className="kpi-value">{pct(report.deterministic.accuracy)}</div></div>
            <div className="kpi"><div className="kpi-label">{t('q.hit_rate', { k: report.retrieval?.k ?? 4 })}</div><div className="kpi-value">{pct(report.retrieval?.hit_rate)}</div></div>
            <div className="kpi"><div className="kpi-label">{t('q.recall')}</div><div className="kpi-value">{pct(report.retrieval?.recall)} / {num(report.retrieval?.mrr, 2)}</div></div>
            <div className="kpi"><div className="kpi-label">{t('q.toon')}</div><div className="kpi-value">{pct(report.prompt_tokens?.saving)}</div></div>
          </div>

          <Card title={t('q.compare')}>
            {report.memos ? (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>{t('q.format')}</th><th>{t('q.memos')}</th><th>{t('q.contract')}</th><th>{t('q.faithfulness')}</th><th>{t('q.citation')}</th><th>{t('q.tokens')}</th><th>{t('q.latency')}</th></tr></thead>
                  <tbody>
                    <FormatRow name="TOON" summary={report.memos.toon} />
                    <FormatRow name="JSON" summary={report.memos.json} />
                  </tbody>
                </table>
              </div>
            ) : <p>{t('q.not_run')}</p>}
            <p className="card-footnote">{t('q.note', { judge: report.judge_model })}</p>
          </Card>

          <div className="dashboard-grid">
            <Card title={t('q.per_case')}>
              {report.retrieval ? (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>{t('q.case')}</th><th>{t('q.retrieved')}</th><th>{t('q.expected')}</th><th>{t('q.recall')}</th></tr></thead>
                    <tbody>{report.retrieval.rows.map((row) => (
                      <tr key={row.id}><td>{row.id}</td><td>{row.retrieved.join(', ')}</td><td>{row.relevant.join(', ')}</td><td>{pct(row.recall)}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
              ) : <p>{t('q.not_run_short')}</p>}
            </Card>
            <Card title={t('q.details')}>
              <div className="risk-stack">
                <div className="risk-line"><span>{t('q.generated')}</span><strong>{report.generated_at.replace('T', ' ').slice(0, 16)} UTC</strong></div>
                <div className="risk-line"><span>{t('q.model')}</span><strong>{report.model}</strong></div>
                <div className="risk-line"><span>{t('q.fallback')}</span><strong>{report.fallback_model}</strong></div>
                <div className="risk-line"><span>{t('q.judge')}</span><strong>{report.judge_model}</strong></div>
                {report.prompt_tokens && <div className="risk-line"><span>{t('q.prompt_tokens')}</span><strong>{num(report.prompt_tokens.toon_tokens)} / {num(report.prompt_tokens.json_tokens)}</strong></div>}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
