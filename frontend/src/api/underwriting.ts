import type { AnalyticsSnapshot, BackendHistoryRow, BackendSubmission, DeploymentStatus, EvalReport, FormReading, HistoryQuery, MitigationPreview, OpsSummary, PortfolioSummary, ReviewInput, SubmissionInput } from '@/types/backend'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

async function parseResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    const detail = body && typeof body === 'object' && 'detail' in body ? String(body.detail) : response.statusText
    throw new Error(detail || 'Backend request failed')
  }
  return body as T
}

export async function fetchOpsSummary(hours: number): Promise<OpsSummary> {
  return parseResponse<OpsSummary>(await fetch(`${API_BASE_URL}/ops/summary?hours=${hours}`))
}

const HISTORY_FIELDS = 'total rows { id property_id decision final_decision risk_score review_status risk_flags total_value_at_risk_inr created_at raw_input prototype_mitigation_model }'
const PORTFOLIO_FIELDS = 'submissions average_score pending_review total_value_inr with_sprinklers with_fire_alarm with_flood_protection mitigation_benefit decisions bands top_drivers hazard_checks'

async function graphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const body = await parseResponse<{ data?: T; errors?: Array<{ message: string }> }>(await fetch(`${API_BASE_URL}/graphql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  }))
  if (body.errors?.length || !body.data) throw new Error(body.errors?.[0]?.message ?? 'GraphQL request failed')
  return body.data
}

const historyVariables = (query: HistoryQuery) => ({ limit: query.limit, offset: query.offset, decision: query.decision === 'All' ? null : query.decision, q: query.q || null, sort: query.sort.toUpperCase(), direction: query.direction.toUpperCase() })
const HISTORY_ARGS = '$limit: Int!, $offset: Int!, $decision: String, $q: String, $sort: SortKey!, $direction: Direction!'
const HISTORY_CALL = 'history(limit: $limit, offset: $offset, decision: $decision, q: $q, sort: $sort, direction: $direction)'

export async function fetchDashboard(query: HistoryQuery): Promise<{ portfolio: PortfolioSummary; history: { rows: BackendHistoryRow[]; total: number } }> {
  return graphql(`query Dashboard(${HISTORY_ARGS}) { portfolio { ${PORTFOLIO_FIELDS} } ${HISTORY_CALL} { ${HISTORY_FIELDS} } }`, historyVariables(query))
}

export async function fetchHistoryPage(query: HistoryQuery): Promise<{ rows: BackendHistoryRow[]; total: number }> {
  return (await graphql<{ history: { rows: BackendHistoryRow[]; total: number } }>(`query Page(${HISTORY_ARGS}) { ${HISTORY_CALL} { ${HISTORY_FIELDS} } }`, historyVariables(query))).history
}

export async function fetchSubmissionDetail(submissionId: number): Promise<BackendSubmission> {
  return parseResponse<BackendSubmission>(await fetch(`${API_BASE_URL}/underwrite/history/${submissionId}`))
}

export async function submitUnderwriting(input: SubmissionInput, images: File[]): Promise<BackendSubmission> {
  const form = new FormData()
  Object.entries(input).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') form.append(key, String(value))
  })
  const image = images[0]
  if (image) form.append('image', image.slice(0, image.size, image.type), image.name)
  return parseResponse<BackendSubmission>(await fetch(`${API_BASE_URL}/underwrite/submit`, {
    method: 'POST',
    body: form,
  }))
}

export async function previewUnderwriting(input: SubmissionInput): Promise<MitigationPreview> {
  const body = new FormData()
  Object.entries(input).forEach(([key, value]) => {
    if (value !== undefined && value !== null) body.append(key, String(value))
  })
  return parseResponse<MitigationPreview>(await fetch(`${API_BASE_URL}/underwrite/preview`, { method: 'POST', body }))
}

export async function checkHealth(): Promise<{ status: string }> {
  return parseResponse<{ status: string }>(await fetch(`${API_BASE_URL}/health`))
}

export async function readPaperForm(image: Blob): Promise<FormReading> {
  const form = new FormData()
  form.append('image', image, 'page2.jpg')
  return parseResponse<FormReading>(await fetch(`${API_BASE_URL}/underwrite/read-form`, { method: 'POST', body: form }))
}

export async function fetchStatus(): Promise<DeploymentStatus> {
  return parseResponse<DeploymentStatus>(await fetch(`${API_BASE_URL}/status`))
}

export async function downloadSubmissionReport(submissionId: number): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}/underwrite/history/${submissionId}/report.pdf`)
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const detail = body && typeof body === 'object' && 'detail' in body ? String(body.detail) : response.statusText
    throw new Error(detail || 'Report generation unavailable')
  }
  return response.blob()
}

export async function reviewSubmission(submissionId: number, review: ReviewInput, csrf: string): Promise<BackendSubmission> {
  return parseResponse<BackendSubmission>(await fetch(`${API_BASE_URL}/underwrite/history/${submissionId}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    body: JSON.stringify(review),
  }))
}

async function changeClaim(submissionId: number, method: 'POST' | 'DELETE', csrf: string): Promise<BackendSubmission> {
  return parseResponse<BackendSubmission>(await fetch(`${API_BASE_URL}/underwrite/history/${submissionId}/claim`, { method, headers: { 'X-CSRF-Token': csrf } }))
}

export async function claimSubmission(submissionId: number, csrf: string): Promise<BackendSubmission> {
  return changeClaim(submissionId, 'POST', csrf)
}

export async function releaseSubmission(submissionId: number, csrf: string): Promise<BackendSubmission> {
  return changeClaim(submissionId, 'DELETE', csrf)
}

export async function fetchAnalytics(): Promise<AnalyticsSnapshot> {
  return parseResponse<AnalyticsSnapshot>(await fetch(`${API_BASE_URL}/underwrite/analytics`))
}

export async function fetchEvals(): Promise<EvalReport> {
  return parseResponse<EvalReport>(await fetch(`${API_BASE_URL}/underwrite/evals`))
}

export const apiBaseUrl = new URL(API_BASE_URL, window.location.origin).toString().replace(/\/$/, '')
