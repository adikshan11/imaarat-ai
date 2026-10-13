import type { AnalyticsSnapshot, BackendHistoryRow, BackendSubmission, DeploymentStatus, FormReading, HistoryQuery, MitigationPreview, OpsSummary, PortfolioSummary, Printout, ReviewInput, SubmissionInput } from '@/types/backend'

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

export async function fetchHistoryPage(query: HistoryQuery): Promise<{ rows: BackendHistoryRow[]; total: number }> {
  const params = new URLSearchParams({ limit: String(query.limit), offset: String(query.offset), sort: query.sort, direction: query.direction })
  if (query.decision !== 'All') params.set('decision', query.decision)
  if (query.q) params.set('q', query.q)
  const response = await fetch(`${API_BASE_URL}/underwrite/history?${params}`)
  const rows = await parseResponse<BackendHistoryRow[]>(response)
  return { rows, total: Number(response.headers.get('X-Total-Count') ?? rows.length) }
}

export async function fetchDashboard(query: HistoryQuery): Promise<{ portfolio: PortfolioSummary; history: { rows: BackendHistoryRow[]; total: number } }> {
  const [portfolio, history] = await Promise.all([fetch(`${API_BASE_URL}/underwrite/portfolio`).then((response) => parseResponse<PortfolioSummary>(response)), fetchHistoryPage(query)])
  return { portfolio, history }
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

export async function issuePrintout(): Promise<Printout> {
  return parseResponse<Printout>(await fetch(`${API_BASE_URL}/paper/printouts`, { method: 'POST' }))
}

export async function readPaperForm(image: Blob, serial?: string): Promise<FormReading> {
  const form = new FormData()
  form.append('image', image, 'page2.jpg')
  if (serial) form.append('serial', serial)
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

export const apiBaseUrl = new URL(API_BASE_URL, window.location.origin).toString().replace(/\/$/, '')
