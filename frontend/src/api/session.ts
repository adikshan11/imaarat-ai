const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

export type Session = { role: 'member' | 'reviewer' | 'operator'; github_id: number | null; csrf_token: string }

async function detail(response: Response) {
  const body = await response.json().catch(() => null)
  return body && typeof body === 'object' && 'detail' in body ? String(body.detail) : response.statusText
}

export async function fetchSession(): Promise<Session | null> {
  const response = await fetch(`${API_BASE_URL}/auth/session`)
  return response.ok ? response.json() : null
}

export async function startSignIn(): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/auth/github/start`, { method: 'POST' })
  if (!response.ok) throw new Error(await detail(response))
  const body = await response.json()
  window.location.assign(body.authorization_url)
}

export async function signOut(csrf: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/auth/logout`, { method: 'POST', headers: { 'X-CSRF-Token': csrf } })
  if (!response.ok && response.status !== 401) throw new Error(await detail(response))
}
