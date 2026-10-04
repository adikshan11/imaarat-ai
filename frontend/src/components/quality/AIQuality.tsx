import { useEffect, useState } from 'react'
import Card from '@/components/shared/Card'
import { fetchEvals } from '@/api/underwriting'
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
  const [report, setReport] = useState<EvalReport | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchEvals().then(setReport).catch((cause) => setError(cause instanceof Error ? cause.message : 'Evaluation report unavailable'))
  }, [])

  return (
    <div>
      <div className="page-subtitle">AI Quality</div>
      <h1 className="page-title">Evaluation results</h1>
      <p className="page-lead">
        Measured, not assumed: a golden set of {report?.deterministic.cases ?? 24} properties covering every scoring rule and decision band, run by CI.
      </p>
      {error && <div className="error-banner">{error}</div>}
      {report && (
        <>
          <div className="kpi-row">
            <div className="kpi"><div className="kpi-label">Decision accuracy</div><div className="kpi-value">{pct(report.deterministic.accuracy)}</div></div>
            <div className="kpi"><div className="kpi-label">RAG hit rate @{report.retrieval?.k ?? 4}</div><div className="kpi-value">{pct(report.retrieval?.hit_rate)}</div></div>
            <div className="kpi"><div className="kpi-label">RAG recall / MRR</div><div className="kpi-value">{pct(report.retrieval?.recall)} / {num(report.retrieval?.mrr, 2)}</div></div>
            <div className="kpi"><div className="kpi-label">TOON token saving</div><div className="kpi-value">{pct(report.prompt_tokens?.saving)}</div></div>
          </div>

          <Card title="TOON vs JSON: the same memo prompt in two formats">
            {report.memos ? (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Format</th><th>Memos</th><th>Contract pass</th><th>Faithfulness</th><th>Citation precision</th><th>Avg input tokens</th><th>Avg latency (ms)</th></tr></thead>
                  <tbody>
                    <FormatRow name="TOON" summary={report.memos.toon} />
                    <FormatRow name="JSON" summary={report.memos.json} />
                  </tbody>
                </table>
              </div>
            ) : <p>Generated-memo comparison not run yet (needs the Gemini key in CI).</p>}
            <p className="card-footnote">
              Faithfulness is scored by a DeepEval LLM judge ({report.judge_model}) against the retrieved evidence. Contract pass means the memo kept the
              deterministic decision, cited only real risk flags and retrieved guideline sections, and invented no amounts or regulations.
            </p>
          </Card>

          <div className="dashboard-grid">
            <Card title="Retrieval per case">
              {report.retrieval ? (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Case</th><th>Retrieved</th><th>Expected</th><th>Recall</th></tr></thead>
                    <tbody>{report.retrieval.rows.map((row) => (
                      <tr key={row.id}><td>{row.id}</td><td>{row.retrieved.join(', ')}</td><td>{row.relevant.join(', ')}</td><td>{pct(row.recall)}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
              ) : <p>Not run yet.</p>}
            </Card>
            <Card title="Run details">
              <div className="risk-stack">
                <div className="risk-line"><span>Generated</span><strong>{report.generated_at.replace('T', ' ').slice(0, 16)} UTC</strong></div>
                <div className="risk-line"><span>Model</span><strong>{report.model}</strong></div>
                <div className="risk-line"><span>Fallback model</span><strong>{report.fallback_model}</strong></div>
                <div className="risk-line"><span>Judge</span><strong>{report.judge_model}</strong></div>
                {report.prompt_tokens && <div className="risk-line"><span>Prompt tokens TOON / JSON</span><strong>{num(report.prompt_tokens.toon_tokens)} / {num(report.prompt_tokens.json_tokens)}</strong></div>}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
