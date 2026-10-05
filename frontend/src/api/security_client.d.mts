export interface SessionIdentity {
  owner_id: string
  role: 'guest' | 'member' | 'reviewer' | 'operator'
  data_policy: 'synthetic' | 'private_local'
  expires_at: number
  epoch: number
}
export class SecurityError extends Error {
  code: string
  status: number
  constructor(code: string, status?: number)
}
export interface SecurityClient {
  request<T = unknown>(path: string, options?: { method?: 'GET' | 'POST' | 'DELETE'; body?: unknown; format?: 'json' | 'blob' }): Promise<T>
  session(guest?: boolean): Promise<SessionIdentity>
  clear(): void
  expire(): void
}
export function approvedLogin(value: string): string
export function createSecurityClient(options: { origin: string; fetch: typeof fetch; onSessionLost?: () => void; timeoutMs?: number; maxResponseBytes?: number; maxRequestBytes?: number; maxFileBytes?: number }): SecurityClient