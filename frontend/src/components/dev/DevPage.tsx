import { useCallback, useEffect, useState, type SubmitEvent } from 'react'
import Card from '@/components/shared/Card'
import { PageLoader, Spinner } from '@/components/shared/Loader'
import {
  fetchDevAiCalls,
  fetchDevArchitecture,
  fetchDevOverview,
  fetchDevRetrieval,
  fetchDevRoutes,
  fetchDevTraces,
  type DevAiCall,
  type DevArchitecture,
  type DevOverview,
  type DevRetrieval,
  type DevRoute,
  type DevTrace,
} from '@/api/dev'
import { useSession } from '@/context/Session'
import '@/components/status/StatusPage.css'
import './DevPage.css'

type Snapshot = { overview: DevOverview; architecture: DevArchitecture; routes: DevRoute[]; calls: DevAiCall[]; traces: DevTrace[] }

const ms = (value: number | null) => (value === null ? '—' : value >= 1000 ? `${(value / 1000).toFixed(1)} s` : `${value} ms`)
const when = (value: string) => new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'medium' })
const uptime = (seconds: number) => (seconds >= 3600 ? `${Math.floor(seconds / 3600)} h ${Math.floor((seconds % 3600) / 60)} min` : `${Math.floor(seconds / 60)} min`)

function Facts({ rows }: { rows: Array<[string, string | number | boolean | null | undefined]> }) {
  return (
    <dl className="dev-facts">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value === null || value === undefined || value === '' ? '—' : typeof value === 'boolean' ? (value ? 'yes' : 'no') : String(value)}</dd>
        </div>
      ))}
    </dl>
  )
}

function Lab() {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<DevRetrieval | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const search = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      setResult(await fetchDevRetrieval(query))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card title="Retrieval lab">
      <p className="muted-text">Type a question to see how guideline search ranks each section: the vector rank and score, the keyword (BM25) rank, and the fused rank that decides what the summary may cite.</p>
      <form className="dev-search" onSubmit={(event) => { void search(event) }}>
        <input type="text" value={query} minLength={2} maxLength={300} required onChange={(event) => setQuery(event.target.value)} aria-label="Search query" placeholder="Cold storage near a river in a flood zone" />
        <button type="submit" className="btn" disabled={busy || query.trim().length < 2}>{busy ? <Spinner /> : 'Rank sections'}</button>
      </form>
      {error && <p className="error-banner" role="alert">{error}</p>}
      {result && !result.available && <p className="muted-text">Search unavailable: {result.reason}</p>}
      {result?.available && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>#</th><th>Section</th><th>Authority</th><th>Vector rank</th><th>Vector score</th><th>Keyword rank</th><th>Fused</th></tr></thead>
            <tbody>
              {result.rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.rank}</td>
                  <td><strong>{row.id}</strong> {row.title}<div className="muted-text">{row.preview}</div></td>
                  <td>{row.authority ?? 'guideline'}</td>
                  <td>{row.dense_rank}</td>
                  <td>{row.dense_score ?? '—'}</td>
                  <td>{row.keyword_rank}</td>
                  <td>{row.fused_score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

function Waterfall({ trace }: { trace: DevTrace }) {
  const scale = Math.max(1, trace.total_ms)
  return (
    <div className="dev-trace">
      <div className="dev-trace-head"><strong>{when(trace.at)}</strong> · {ms(trace.total_ms)} · {trace.decision ?? 'no decision'} · AI summary: {trace.memo_status ?? 'unknown'}</div>
      <div className="ops-waterfall">
        {trace.spans.map((span, index) => (
          <div className="ops-span" key={`${span.name}-${index}`}>
            <span className="ops-span-name">{span.name}</span>
            <span className="ops-span-track">
              <span className={`ops-span-bar ${span.status === 'ok' ? 'ops-ok' : 'ops-error'}`} style={{ left: `${(span.start_ms / scale) * 100}%`, width: `${Math.max(0.6, (span.duration_ms / scale) * 100)}%` }} />
            </span>
            <span className="ops-span-time">{ms(span.duration_ms)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function DevPage() {
  const { session } = useSession()
  const [data, setData] = useState<Snapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const owner = session?.role === 'operator'

  const load = useCallback(async () => {
    try {
      const [overview, architecture, routes, calls, traces] = await Promise.all([fetchDevOverview(), fetchDevArchitecture(), fetchDevRoutes(), fetchDevAiCalls(), fetchDevTraces()])
      setData({ overview, architecture, routes, calls, traces })
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }, [])

  useEffect(() => { if (owner) void load() }, [owner, load])

  if (!owner) return <div className="ops-page" lang="en"><p className="muted-text">The dev console is for the owner of this deployment.</p></div>

  return (
    <div className="ops-page dev-page" lang="en">
      <header className="dev-head">
        <div>
          <h1>Dev console</h1>
          <p className="muted-text">How this service is built and what it is doing right now. Read only: no visitor inputs, no secrets.</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => { void load() }}>Refresh</button>
      </header>
      {error && <p className="error-banner" role="alert">{error}</p>}
      {!data && !error && <PageLoader />}
      {data && (
        <>
          <Card title="Deployment">
            <Facts rows={[
              ['Version', data.overview.version],
              ['Environment', data.overview.deployment.environment],
              ['Region', data.overview.deployment.region],
              ['Commit', data.overview.deployment.commit],
              ['Branch', data.overview.deployment.branch],
              ['Python', data.overview.deployment.python],
              ['Database', data.overview.deployment.database],
              ['Process uptime', uptime(data.overview.deployment.uptime_seconds)],
            ]} />
          </Card>

          <Card title="AI configuration">
            <Facts rows={[
              ['Provider', data.overview.ai.provider],
              ['Generation model', data.overview.ai.model],
              ['Embedding model', data.overview.ai.embedding_model],
              ['Eval judge', data.overview.ai.judge_model],
              ['Prompt format', data.overview.ai.prompt_format],
              ['Thinking level', Object.entries(data.overview.ai.thinking).map(([stage, level]) => `${stage} ${level}`).join(', ')],
              ['Attempts per call', data.overview.ai.attempts],
              ['Call timeout', ms(data.overview.ai.call_timeout_ms)],
              ['Request budget', `${data.overview.ai.request_seconds} s`],
              ['Output tokens per call', data.overview.ai.output_tokens],
              ['AI key configured', data.overview.ai.key_configured],
              ['Langfuse tracing', data.overview.ai.tracing],
            ]} />
            <h3 className="dev-sub">Daily limits and what is left</h3>
            <Facts rows={[
              ...Object.entries(data.overview.limits).map(([name, value]): [string, number] => [`limit ${name}`, value]),
              ...Object.entries(data.overview.budget).filter(([, value]) => typeof value === 'number').map(([name, value]): [string, number] => [name.replaceAll('_', ' '), value as number]),
            ]} />
          </Card>

          <Card title="Retrieval corpus">
            <Facts rows={[
              ['Store', data.overview.retrieval.store],
              ['Guidelines', data.overview.retrieval.guidelines],
              ['Reference notes', data.overview.retrieval.reference_notes],
              ['Corpus hash', data.overview.retrieval.corpus_hash],
            ]} />
          </Card>

          <Lab />

          <Card title="Assessment workflow (LangGraph)">
            <ol className="dev-flow">
              {data.architecture.nodes.map((node) => (
                <li key={node.id}><code>{node.id}</code><span>{node.note}</span></li>
              ))}
            </ol>
            <div className="table-wrap">
              <table>
                <thead><tr><th>From</th><th>To</th><th>Kind</th></tr></thead>
                <tbody>{data.architecture.edges.map((edge) => <tr key={`${edge.from}-${edge.to}`}><td><code>{edge.from}</code></td><td><code>{edge.to}</code></td><td>{edge.conditional ? 'conditional' : 'always'}</td></tr>)}</tbody>
              </table>
            </div>
            <details>
              <summary>Mermaid source</summary>
              <pre className="dev-code">{data.architecture.mermaid}</pre>
            </details>
          </Card>

          <Card title="Recent AI calls">
            <div className="table-wrap">
              <table>
                <thead><tr><th>Time</th><th>Stage</th><th>Status</th><th>Model</th><th>Tokens in / out</th><th>Latency</th></tr></thead>
                <tbody>
                  {data.calls.map((call, index) => (
                    <tr key={`${call.at}-${index}`}><td>{when(call.at)}</td><td>{call.stage}</td><td>{call.status}</td><td>{call.model ?? '—'}</td><td>{call.input_tokens ?? '—'} / {call.output_tokens ?? '—'}</td><td>{ms(call.latency_ms)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!data.calls.length && <p className="muted-text">No AI calls recorded yet.</p>}
          </Card>

          <Card title="Recent assessment traces">
            {data.traces.map((trace, index) => <Waterfall key={`${trace.at}-${index}`} trace={trace} />)}
            {!data.traces.length && <p className="muted-text">No assessments recorded yet.</p>}
          </Card>

          <Card title="API surface">
            <details>
              <summary>{data.routes.length} routes</summary>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Method</th><th>Path</th><th>Handler</th></tr></thead>
                  <tbody>{data.routes.map((route) => <tr key={`${route.method}-${route.path}`}><td>{route.method}</td><td><code>{route.path}</code></td><td>{route.name}</td></tr>)}</tbody>
                </table>
              </div>
            </details>
          </Card>
        </>
      )}
    </div>
  )
}
