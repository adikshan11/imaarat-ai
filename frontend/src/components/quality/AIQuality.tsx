import { useEffect, useState } from 'react'
import Card from '@/components/shared/Card'
import { fetchEvals } from '@/api/underwriting'
import { usePreferences } from '@/context/Preferences'
import type { EvalReport, FormatSummary } from '@/types/backend'
import './AIQuality.css'

const pct = (value: number | null | undefined) => (typeof value !== 'number' || !Number.isFinite(value) ? 'Not measured' : `${Math.round(value * 100)}%`)
const num = (value: number | null | undefined, digits = 0) => (typeof value !== 'number' || !Number.isFinite(value) ? 'Not measured' : value.toLocaleString('en-IN', { maximumFractionDigits: digits }))

function FormatRow({ name, summary }: { name: string; summary: FormatSummary }) {
  return (
    <tr>
      <td><strong>{name}</strong></td>
      <td>{summary.memos}</td>
      <td>{summary.generation_attempts ?? 'Unknown'}</td>
      <td>{pct(summary.contract_pass_rate)}</td>
      <td>{num(summary.faithfulness, 2)}</td>
      <td>{summary.faithfulness_cases ?? 'Unknown'} / {summary.memos}</td>
      <td>{summary.failed ?? 'Unknown'}</td>
      <td>{pct(summary.citation_precision)}</td>
      <td>{num(summary.avg_input_tokens)}</td>
      <td>{num(summary.avg_latency_ms)}</td>
    </tr>
  )
}

export function QualityResults({ report }: { report: EvalReport | null }) {
  const metadata = report?.metadata
  const thresholds = report?.retrieval?.thresholds ?? metadata?.retrieval_thresholds
  const result = report?.passed === false || report?.status === 'failed' ? 'Failed' : report?.passed === true ? 'Passed bounded synthetic checks' : 'Not run / not assessed'
  return (
    <div className="quality-report" lang="en" dir="ltr">
      <p className="page-lead">Developer evaluation evidence. Technical metadata is shown in English in every locale; native translation accuracy has not been verified.</p>
      <div className="quality-status" role="status">
        <strong>AI evaluation: {result}</strong>
        <span>Run mode: {report?.run_mode ?? 'not_run'}</span>
        <span>Report timestamp: {report?.generated_at ?? 'Not run'}</span>
        <span>This report is a snapshot, not the current deployment’s AI capability status.</span>
      </div>
      <Card title="Deterministic rule checks">
        <p>{report?.deterministic?.cases === undefined ? 'Not run' : `${report.deterministic.cases} handcrafted synthetic cases`} · Rule agreement: {pct(report?.deterministic?.accuracy)}</p>
        <p className="card-footnote">Decision and flag agreement with the rule engine, not LLM accuracy. These are not real properties, an independent validation set, or a percentage of scoring-rule coverage.</p>
      </Card>
      <Card title="Live evaluation sections">
        <div className="risk-stack">
          {(['retrieval', 'prompt_tokens', 'memos'] as const).map((name) => (
            <div className="risk-line" key={name}><span>{name}</span><strong>{report?.sections?.[name]?.status ?? 'Not run'}{report?.sections?.[name]?.reason ? ` · ${report.sections[name].reason}` : ''}</strong></div>
          ))}
        </div>
        <p>Retrieval hit rate: {pct(report?.retrieval?.hit_rate)} · Recall: {pct(report?.retrieval?.recall)} · MRR: {num(report?.retrieval?.mrr, 2)}</p>
        <p>Hit-rate threshold: {pct(thresholds?.hit_rate)} · Recall threshold: {pct(thresholds?.recall)} · Retrieval check: {report?.retrieval?.passed === true ? 'Passed' : report?.retrieval?.passed === false ? 'Failed' : 'Not assessed'}</p>
        <p className="card-footnote">{metadata?.retrieval_acceptance ?? 'Retrieval acceptance criteria not recorded.'}</p>
        <p>Measured TOON / JSON prompt tokens: {num(report?.prompt_tokens?.toon_tokens)} / {num(report?.prompt_tokens?.json_tokens)} · Relative token difference: {pct(report?.prompt_tokens?.saving)}</p>
        <p className="card-footnote">{metadata?.prompt_token_scope ?? 'Token-count scope not recorded.'}</p>
      </Card>
      <Card title="TOON / JSON memo comparison">
        {report?.memos?.toon || report?.memos?.json ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Format</th><th>Planned memo slots</th><th>Generation attempts</th><th>Contract pass</th><th>Faithfulness</th><th>Judge denominator</th><th>Failed executions</th><th>Citation relevance precision</th><th>Avg input tokens</th><th>Avg latency (ms)</th></tr></thead>
              <tbody>
                {report.memos.toon && <FormatRow name="TOON" summary={report.memos.toon} />}
                {report.memos.json && <FormatRow name="JSON" summary={report.memos.json} />}
              </tbody>
            </table>
          </div>
        ) : <p>Not run. Live memo metrics require an approved credential setup and an explicitly requested bounded run.</p>}
        <p className="card-footnote">Faithfulness averages exclude failed executions and absent judge scores; below-threshold scores remain included. The denominator shows scored / planned case-format slots, including preparation and judge setup failures. Generation attempts count calls begun, including failed generation calls. Contract pass does not prove that every claim is true. Citation precision compares citations with manual relevance labels, not a human grounding judgment.</p>
        {report?.memos?.rows?.map((row) => <p key={`${row.id}-${row.format}`}><strong>{row.id} / {row.format}</strong>: {row.status} · {row.passed ? 'check passed' : 'check failed'} · {row.reason}{row.model ? ` · Used model: ${row.model}` : ''}</p>)}
      </Card>
      <Card title="Technical run metadata">
        <div className="risk-stack">
          <div className="risk-line"><span>Configured generation / fallback models</span><strong>{report?.model ?? 'Unknown'} / {report?.fallback_model ?? 'Unknown'}</strong></div>
          <div className="risk-line"><span>Configured LLM judge / threshold</span><strong>{report?.judge_model ?? 'Unknown'} / {num(metadata?.faithfulness_threshold, 2)}</strong></div>
          <div className="risk-line"><span>Chunking</span><strong>{metadata?.chunking ?? 'Unknown'}</strong></div>
          <div className="risk-line"><span>Corpus sections / document characters</span><strong>{num(metadata?.corpus_sections)} / {num(metadata?.corpus_characters)}</strong></div>
          <div className="risk-line"><span>Corpus tokens</span><strong>{num(metadata?.corpus_tokens)} · {metadata?.token_availability ?? 'Unknown'}</strong></div>
          <div className="risk-line"><span>Retrieval k / embedding model / configured store</span><strong>{num(metadata?.k)} / {metadata?.embedding_model ?? 'Unknown'} / {metadata?.configured_vector_store ?? 'Unknown'}</strong></div>
          <div className="risk-line"><span>Selected live synthetic cases / memo generations</span><strong>{metadata?.selected_live_cases?.join(', ') || 'None recorded'} / {num(metadata?.memo_generations)}</strong></div>
        </div>
        {metadata?.section_characters && <p>Measured characters per section document: {Object.entries(metadata.section_characters).map(([id, length]) => `${id}: ${length}`).join(' · ')}</p>}
        <p className="card-footnote">{metadata?.generation_budget_note ?? 'No live generation budget recorded.'}</p>
      </Card>
    </div>
  )
}

export default function AIQuality() {
  const { t } = usePreferences()
  const [report, setReport] = useState<EvalReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    fetchEvals().then((data) => { if (active) setReport(data) }).catch(() => {
      if (active) setError('The evaluation report could not be loaded. No result is implied.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  return (
    <div>
      <div className="page-subtitle">{t('q.eyebrow')}</div>
      <h1 className="page-title">{t('q.title')}</h1>
      {loading && <p role="status" lang="en">Loading evaluation evidence…</p>}
      {error && <div className="error-banner" role="alert" lang="en">{error}</div>}
      {!loading && <QualityResults report={report} />}
    </div>
  )
}
