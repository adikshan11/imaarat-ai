import type { BackendHistoryRow, BackendSubmission, MitigationPreview, SubmissionInput } from '@/types/backend'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

async function parseResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    const detail = body && typeof body === 'object' && 'detail' in body ? String(body.detail) : response.statusText
    throw new Error(detail || 'Backend request failed')
  }
  return body as T
}

export async function fetchHistory(): Promise<BackendHistoryRow[]> {
  return parseResponse<BackendHistoryRow[]>(await fetch(`${API_BASE_URL}/underwrite/history`))
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

export async function downloadSubmissionReport(submissionId: number): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}/underwrite/history/${submissionId}/report.pdf`)
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const detail = body && typeof body === 'object' && 'detail' in body ? String(body.detail) : response.statusText
    throw new Error(detail || 'Report generation unavailable')
  }
  return response.blob()
}
