const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

export type DevOverview = {
  version: string
  deployment: { environment: string; region: string | null; commit: string | null; branch: string | null; python: string; database: string; uptime_seconds: number }
  ai: { provider: string; model: string; embedding_model: string; judge_model: string; prompt_format: string; thinking: Record<string, string>; attempts: number; call_timeout_ms: number; request_seconds: number; output_tokens: number; key_configured: boolean; tracing: boolean }
  limits: Record<string, number>
  budget: Record<string, unknown>
  retrieval: { store: string; guidelines: number; reference_notes: number; corpus_hash: string }
}
export type DevArchitecture = { nodes: Array<{ id: string; note: string }>; edges: Array<{ from: string; to: string; conditional: boolean }>; mermaid: string }
export type DevRoute = { method: string; path: string; name: string }
export type DevAiCall = { at: string; stage: string; status: string; model: string | null; input_tokens: number | null; output_tokens: number | null; latency_ms: number | null }
export type DevTrace = { at: string; total_ms: number; memo_status: string | null; decision: string | null; spans: Array<{ name: string; start_ms: number; duration_ms: number; status: string }> }
export type DevRetrieval = {
  available: boolean
  reason: string | null
  rows: Array<{ id: string; title: string; authority: string | null; rank: number; dense_rank: number; dense_score: number | null; keyword_rank: number; fused_score: number; preview: string }>
}

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/dev/${path}`)
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body && typeof body === 'object' && 'detail' in body ? String(body.detail) : response.statusText)
  }
  return response.json()
}

export const fetchDevOverview = () => get<DevOverview>('overview')
export const fetchDevArchitecture = () => get<DevArchitecture>('architecture')
export const fetchDevRoutes = () => get<DevRoute[]>('routes')
export const fetchDevAiCalls = () => get<DevAiCall[]>('ai-calls')
export const fetchDevTraces = () => get<DevTrace[]>('traces')
export const fetchDevRetrieval = (query: string) => get<DevRetrieval>(`retrieval?q=${encodeURIComponent(query)}`)
