import type { AnalyticsSnapshot, BackendHistoryRow, BackendSubmission, DeploymentStatus, EvalReport, FormReading, MitigationPreview, ReviewInput, SubmissionInput } from '@/types/backend'
import { securityClient } from './session'

export async function fetchHistory(): Promise<BackendHistoryRow[]> {
  return securityClient().request<BackendHistoryRow[]>('/underwrite/history')
}

export async function fetchSubmissionDetail(submissionId: number): Promise<BackendSubmission> {
  return securityClient().request<BackendSubmission>(`/underwrite/history/${submissionId}`)
}

export async function submitUnderwriting(input: SubmissionInput, images: File[]): Promise<BackendSubmission> {
  const form = new FormData()
  Object.entries(input).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') form.append(key, String(value))
  })
  const image = images[0]
  if (image) form.append('image', image.slice(0, image.size, image.type), image.name)
  return securityClient().request<BackendSubmission>('/underwrite/submit', {
    method: 'POST',
    body: form,
  })
}

export async function previewUnderwriting(input: SubmissionInput): Promise<MitigationPreview> {
  const body = new FormData()
  Object.entries(input).forEach(([key, value]) => {
    if (value !== undefined && value !== null) body.append(key, String(value))
  })
  return securityClient().request<MitigationPreview>('/underwrite/preview', { method: 'POST', body })
}

export async function checkHealth(): Promise<{ status: string }> {
  return securityClient().request<{ status: string }>('/health')
}

export async function readPaperForm(image: Blob): Promise<FormReading> {
  const form = new FormData()
  form.append('image', image, 'page2.jpg')
  return securityClient().request<FormReading>('/underwrite/read-form', { method: 'POST', body: form })
}

export async function fetchStatus(): Promise<DeploymentStatus> {
  return securityClient().request<DeploymentStatus>('/status')
}

export async function downloadSubmissionReport(submissionId: number): Promise<Blob> {
  return securityClient().request<Blob>(`/underwrite/history/${submissionId}/report.pdf`, { format: 'blob' })
}

export async function reviewSubmission(submissionId: number, review: ReviewInput): Promise<BackendSubmission> {
  return securityClient().request<BackendSubmission>(`/underwrite/history/${submissionId}/review`, {
    method: 'POST',
    body: review,
  })
}

export async function fetchAnalytics(): Promise<AnalyticsSnapshot> {
  return securityClient().request<AnalyticsSnapshot>('/underwrite/analytics')
}

export async function fetchEvals(): Promise<EvalReport> {
  return securityClient().request<EvalReport>('/underwrite/evals')
}

export const apiBaseUrl = window.location.origin + '/api'
