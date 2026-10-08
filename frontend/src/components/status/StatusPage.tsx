import { Suspense, lazy, useEffect, useState } from 'react'
import Card from '@/components/shared/Card'
import { PageSkeleton } from '@/components/shared/Loader'
import { fetchOpsSummary } from '@/api/underwriting'
import { useRiskContext } from '@/context/RiskContext'
import type { OpsSpan, OpsSummary } from '@/types/backend'
import './StatusPage.css'

const Integrations = lazy(() => import('@/components/integrations/Integrations'))

const WINDOWS = [{ hours: 24, label: '24 hours' }, { hours: 168, label: '7 days' }]

function ms(value: number | null | undefined) {
  if (value === null || value === undefined) return '—'
  return value >= 1000 ? `${(value / 1000).toFixed(1)} s` : `${value} ms`
}

function mb(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function share(part: number, whole: number) {
  return whole ? `${Math.round((part / whole) * 1000) / 10}%` : '—'
}

function when(value: string) {
  return new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

function bucketLabel(bucket: string, hours: number) {
  return hours <= 48 ? `${bucket.slice(11, 16)} UTC` : bucket.slice(5)
}

function Bars({ points, series, hours, summary }: { points: Array<{ bucket: string; values: number[] }>; series: Array<{ name: string; tone: string }>; hours: number; summary: string }) {
  if (!points.length) return <p className="muted-text">No data in this window yet.</p>
  const peak = Math.max(1, ...points.map((point) => point.values.reduce((sum, value) => sum + value, 0)))
  const width = points.length * 10
  return (
    <figure className="ops-chart">
      <div className="ops-chart-peak">{peak.toLocaleString('en-IN')}</div>
      <svg viewBox={`0 0 ${width} 100`} preserveAspectRatio="none" role="img" aria-label={summary}>
        {points.map((point, index) => {
          let top = 100
          return <g key={point.bucket}>
            <title>{`${bucketLabel(point.bucket, hours)}: ${series.map((item, position) => `${item.name} ${point.values[position]}`).join(', ')}`}</title>
            {point.values.map((value, position) => {
              const height = (value / peak) * 100
              top -= height
              return <rect key={series[position].name} className={`ops-${series[position].tone}`} x={index * 10 + 1} y={top} width={8} height={height} />
            })}
          </g>
        })}
      </svg>
      <figcaption>
        <span>{bucketLabel(points[0].bucket, hours)}</span>
        <span className="ops-legend">{series.map((item) => <span key={item.name}><i className={`ops-${item.tone}`} />{item.name}</span>)}</span>
        <span>{bucketLabel(points[points.length - 1].bucket, hours)}</span>
      </figcaption>
    </figure>
  )
}

function Waterfall({ spans, total }: { spans: OpsSpan[]; total: number }) {
  const scale = Math.max(1, total)
  return (
    <div className="ops-waterfall">
      {spans.map((span, index) => (
        <div className="ops-span" key={`${span.name}-${index}`}>
          <span className="ops-span-name">{span.name}</span>
          <span className="ops-span-track">
            <span className={`ops-span-bar ${span.status === 'ok' ? 'ops-ok' : 'ops-error'}`} style={{ left: `${(span.start_ms / scale) * 100}%`, width: `${Math.max(0.6, (span.duration_ms / scale) * 100)}%` }} title={`${span.status}, starts at ${ms(span.start_ms)}`} />
          </span>
          <span className="ops-span-time">{ms(span.duration_ms)}{span.status !== 'ok' && <em> {span.status}</em>}</span>
        </div>
      ))}
    </div>
  )
}

export default function StatusPage() {
  const { status } = useRiskContext()
  const [hours, setHours] = useState(24)
  const [summary, setSummary] = useState<OpsSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const load = () => {
      if (document.visibilityState !== 'visible') return
      fetchOpsSummary(hours)
        .then((data) => { if (active) { setSummary(data); setError(null) } })
        .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Status data is unavailable') })
    }
    load()
    const timer = window.setInterval(load, 30_000)
    return () => { active = false; window.clearInterval(timer) }
  }, [hours])

  const requests = summary?.requests
  const ai = summary?.ai
  const memoTotal = Object.values(ai?.memo_outcomes ?? {}).reduce((sum, value) => sum + value, 0)
  const geminiCalls = Object.values(ai?.stages ?? {}).reduce((sum, stage) => sum + stage.calls, 0)
  const geminiFailed = Object.values(ai?.stages ?? {}).reduce((sum, stage) => sum + stage.failed, 0)
  const tokensIn = Object.values(ai?.stages ?? {}).reduce((sum, stage) => sum + stage.input_tokens, 0)
  const tokensOut = Object.values(ai?.stages ?? {}).reduce((sum, stage) => sum + stage.output_tokens, 0)
  const windowLabel = WINDOWS.find((item) => item.hours === hours)?.label

  return (
    <div className="ops-page" id="quality" lang="en" dir="ltr">
      <div className="page-subtitle">System status</div>
      <div className="page-heading-row">
        <div>
          <h1 className="page-title">Status &amp; quality</h1>
          <p className="page-lead">Live traffic, latency, AI calls and token use. Only route names and timings are stored, for 14 days.</p>
        </div>
        <div className="ops-window" role="group" aria-label="Time window">
          {WINDOWS.map((item) => <button key={item.hours} type="button" className={`btn ${item.hours === hours ? 'btn-primary' : 'btn-secondary'}`} aria-pressed={item.hours === hours} onClick={() => setHours(item.hours)}>{item.label}</button>)}
        </div>
      </div>

      {error && <div className="error-banner" role="alert">{error}</div>}
      {!summary && !error && <PageSkeleton heading={false} />}

      {summary && requests && ai && <>
        <div className="kpi-row">
          <div className="kpi"><div className="kpi-label">Version</div><div className="kpi-value">{status?.version ?? '—'}</div><div className="kpi-hint">AI {status?.ai ? 'on' : 'off'} · Langfuse tracing {status?.tracing ? 'on' : 'off'}</div></div>
          <div className="kpi"><div className="kpi-label">Requests</div><div className="kpi-value">{requests.total.toLocaleString('en-IN')}</div><div className="kpi-hint">{share(requests.server_errors, requests.total)} server errors · {requests.cold_starts} cold starts</div></div>
          <div className="kpi"><div className="kpi-label">Assessment time</div><div className="kpi-value">{ms(summary.assessments.p50_ms)}</div><div className="kpi-hint">p50 · p95 {ms(summary.assessments.p95_ms)} · {summary.assessments.total} runs</div></div>
          <div className="kpi"><div className="kpi-label">Gemini tokens</div><div className="kpi-value">{(tokensIn + tokensOut).toLocaleString('en-IN')}</div><div className="kpi-hint">{windowLabel}: {tokensIn.toLocaleString('en-IN')} in · {tokensOut.toLocaleString('en-IN')} out · {ai.budget.generations_left ?? '—'} generations left today</div></div>
        </div>
        <p className="card-footnote">AI memos available: {share(ai.memo_outcomes.Available ?? 0, memoTotal)} · {ai.budget.admissions_left} AI assessments left today{summary.storage ? ` · database ${mb(summary.storage.database_bytes)} of ${mb(summary.storage.limit_bytes)} (${share(summary.storage.database_bytes, summary.storage.limit_bytes)})` : ''}</p>

        <Card title="Traffic">
          <Bars hours={hours} summary={`${requests.total} requests, ${requests.client_errors} client errors, ${requests.server_errors} server errors`} series={[{ name: 'OK', tone: 'ok' }, { name: '4xx', tone: 'warn' }, { name: '5xx', tone: 'error' }]}
            points={requests.timeline.map((point) => ({ bucket: point.bucket, values: [point.requests - point.client_errors - point.server_errors, point.client_errors, point.server_errors] }))} />
          {Object.keys(requests.error_types).length > 0 && <p className="card-footnote">Unhandled errors by type: {Object.entries(requests.error_types).map(([name, count]) => `${name} ${count}`).join(', ')}</p>}
        </Card>

        <Card title="Latency by route">
          <div className="table-wrap">
            <table className="table-wide">
              <thead><tr><th>Route</th><th>Requests</th><th>p50</th><th>p95</th><th>p99</th><th>5xx rate</th></tr></thead>
              <tbody>{requests.routes.map((route) => <tr key={route.route}><td><code>{route.route}</code></td><td>{route.count}</td><td>{ms(route.p50_ms)}</td><td>{ms(route.p95_ms)}</td><td>{ms(route.p99_ms)}</td><td>{share(route.error_rate * route.count, route.count)}</td></tr>)}</tbody>
            </table>
          </div>
        </Card>

        <Card title="AI (Gemini)">
          <Bars hours={hours} summary={`${geminiCalls} Gemini calls, ${geminiFailed} failed`} series={[{ name: 'Succeeded', tone: 'ok' }, { name: 'Failed', tone: 'error' }]}
            points={ai.timeline.map((point) => ({ bucket: point.bucket, values: [point.calls - point.failed, point.failed] }))} />
          <div className="table-wrap">
            <table className="table-wide">
              <thead><tr><th>Stage</th><th>Calls</th><th>Failed</th><th>p50</th><th>p95</th><th>Input tokens</th><th>Output tokens</th></tr></thead>
              <tbody>{Object.entries(ai.stages).map(([name, stage]) => <tr key={name}><td>{name}</td><td>{stage.calls}</td><td>{stage.failed}</td><td>{ms(stage.p50_ms)}</td><td>{ms(stage.p95_ms)}</td><td>{stage.input_tokens.toLocaleString('en-IN')}</td><td>{stage.output_tokens.toLocaleString('en-IN')}</td></tr>)}</tbody>
            </table>
          </div>
          <p className="card-footnote">Every Gemini attempt is counted, retries included. Failed calls are free-tier capacity Google shed; the rules still decide every assessment.</p>
        </Card>

        <Card title="Recent assessments, step by step">
          {summary.assessments.recent.length === 0 && <p className="muted-text">No assessments in this window yet.</p>}
          {summary.assessments.recent.map((trace) => (
            <details className="ops-trace" key={trace.created_at}>
              <summary><span>{new Date(trace.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span><strong>{ms(trace.total_ms)}</strong><span>{trace.decision ?? '—'}</span><span>memo {trace.memo_status ?? 'unknown'}</span></summary>
              <Waterfall spans={trace.spans} total={trace.total_ms} />
            </details>
          ))}
        </Card>

        <Card title="Quality and testing (CI)">
          <p className="card-footnote">Runs on main. Load tests use a CI copy of the API with AI off; Lighthouse audits the live site; evaluations use synthetic cases, so rule agreement is not LLM accuracy.</p>
          <h3 className="ops-subhead">Load test</h3>
          {summary.ci_runs.load?.length ? <div className="table-wrap"><table className="table-wide">
            <thead><tr><th>Run</th><th>Users</th><th>Req/s</th><th>p50</th><th>p95</th><th>p99</th><th>Submit p95</th><th>Failures</th></tr></thead>
            <tbody>{summary.ci_runs.load.map((run) => <tr key={run.run_url}><td><a href={run.run_url} target="_blank" rel="noopener noreferrer">{when(run.created_at)}</a></td><td>{run.summary.users}</td><td>{run.summary.rps}</td><td>{ms(run.summary.p50_ms)}</td><td>{ms(run.summary.p95_ms)}</td><td>{ms(run.summary.p99_ms)}</td><td>{ms(run.summary.submit_p95_ms)}</td><td>{run.summary.failures} / {run.summary.requests.toLocaleString('en-IN')}</td></tr>)}</tbody>
          </table></div> : <p className="muted-text">No load test published from main yet.</p>}
          <h3 className="ops-subhead">Lighthouse</h3>
          {summary.ci_runs.lighthouse?.length ? <div className="table-wrap"><table className="table-wide">
            <thead><tr><th>Run</th><th>Device</th><th>Performance</th><th>LCP</th><th>Blocking time</th><th>Layout shift</th><th>Accessibility</th></tr></thead>
            <tbody>{summary.ci_runs.lighthouse.flatMap((run) => Object.entries(run.summary).map(([device, result]) => <tr key={`${run.run_url}-${device}`}><td><a href={run.run_url} target="_blank" rel="noopener noreferrer">{when(run.created_at)}</a></td><td>{device}</td><td>{result.performance}</td><td>{ms(result.lcp_ms)}</td><td>{ms(result.tbt_ms)}</td><td>{result.cls}</td><td>{result.accessibility}</td></tr>))}</tbody>
          </table></div> : <p className="muted-text">No Lighthouse audit published from main yet.</p>}
          <h3 className="ops-subhead">Evaluations</h3>
          {summary.ci_runs.evals?.length ? <div className="table-wrap"><table className="table-wide">
            <thead><tr><th>Run</th><th>Mode</th><th>Result</th><th>Rules agreement</th><th>Guideline search recall</th><th>Prompt tokens TOON / JSON</th><th>Memo contract pass</th><th>Faithfulness</th></tr></thead>
            <tbody>{summary.ci_runs.evals.map((run) => <tr key={run.run_url}><td><a href={run.run_url} target="_blank" rel="noopener noreferrer">{when(run.created_at)}</a></td><td>{run.summary.mode}</td><td>{run.summary.passed ? 'passed' : 'not passed'}</td><td>{share(run.summary.rules_agreement, 1)} of {run.summary.rules_cases}</td><td>{run.summary.retrieval_recall === null ? '—' : `${share(run.summary.retrieval_recall, 1)} (${run.summary.retrieval_cases} cases)`}</td><td>{typeof run.summary.toon_tokens === 'number' && typeof run.summary.json_tokens === 'number' ? `${run.summary.toon_tokens.toLocaleString('en-IN')} / ${run.summary.json_tokens.toLocaleString('en-IN')}` : '—'}{run.summary.toon_token_saving === null ? '' : ` (${share(run.summary.toon_token_saving, 1)} fewer)`}</td><td>{typeof run.summary.memo_contract_pass === 'number' ? share(run.summary.memo_contract_pass, 1) : '—'}</td><td>{typeof run.summary.memo_faithfulness === 'number' ? run.summary.memo_faithfulness.toFixed(2) : '—'}</td></tr>)}</tbody>
          </table></div> : <p className="muted-text">No evaluation published from main yet.</p>}
        </Card>

        <p className="card-footnote">Generated {new Date(summary.generated_at).toLocaleString('en-IN')} · refreshes every 30 seconds while this tab is open.</p>
      </>}
      <Suspense fallback={<PageSkeleton heading={false} />}>
        <Integrations />
      </Suspense>
    </div>
  )
}
