const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

export type Session = { role: 'member' | 'reviewer' | 'operator'; github_id: number | null; name: string | null; csrf_token: string }
export type Provider = 'github' | 'google'
export type Providers = Record<Provider, boolean>

async function detail(response: Response) {
  const body = await response.json().catch(() => null)
  return body && typeof body === 'object' && 'detail' in body ? String(body.detail) : response.statusText
}

export async function fetchSession(): Promise<Session | null> {
  const response = await fetch(`${API_BASE_URL}/auth/session`)
  return response.ok ? response.json() : null
}

export async function fetchProviders(): Promise<Providers> {
  const response = await fetch(`${API_BASE_URL}/auth/providers`)
  return response.ok ? response.json() : { github: true, google: false }
}

export async function startSignIn(provider: Provider = 'github'): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/auth/${provider}/start`, { method: 'POST' })
  if (!response.ok) throw new Error(await detail(response))
  const body = await response.json()
  window.location.assign(body.authorization_url)
}

export async function signOut(csrf: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/auth/logout`, { method: 'POST', headers: { 'X-CSRF-Token': csrf } })
  if (!response.ok && response.status !== 401) throw new Error(await detail(response))
}
