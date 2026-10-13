const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

export type Profile = { full_name: string | null; phone: string | null; has_photo: boolean; complete: boolean }
export type Timing = { now: number; idle_seconds: number; max_seconds: number; expires_at: number }
export type Session = { role: 'member' | 'reviewer' | 'operator'; github_id: number | null; name: string | null; csrf_token: string; profile: Profile; timing: Timing }
export type Provider = 'google' | 'owner'
export type Providers = Record<Provider, boolean>

async function detail(response: Response) {
  const body = await response.json().catch(() => null)
  if (!body || typeof body !== 'object' || !('detail' in body)) return response.statusText
  const found = body.detail
  if (Array.isArray(found)) return String(found[0]?.msg ?? response.statusText).replace(/^Value error, /, '')
  return String(found)
}

export async function fetchSession(): Promise<Session | null> {
  const response = await fetch(`${API_BASE_URL}/auth/session`)
  return response.ok ? response.json() : null
}

export async function fetchProviders(): Promise<Providers> {
  const response = await fetch(`${API_BASE_URL}/auth/providers`)
  return response.ok ? response.json() : { google: false, owner: false }
}

export async function startSignIn(provider: Provider = 'google'): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/auth/${provider}/start`, { method: 'POST' })
  if (!response.ok) throw new Error(await detail(response))
  const body = await response.json()
  window.location.assign(body.authorization_url)
}

async function passwordRequest(path: string, body: Record<string, string | null>): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/auth/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!response.ok) throw new Error(await detail(response))
}

export function passwordLogin(identifier: string, password: string): Promise<void> {
  return passwordRequest('login', { identifier, password })
}

export function passwordSignup(name: string, identifier: string, password: string): Promise<void> {
  const email = identifier.includes('@') ? identifier : null
  return passwordRequest('signup', { name, email, phone: email ? null : identifier, password })
}

export async function signOut(csrf: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/auth/logout`, { method: 'POST', headers: { 'X-CSRF-Token': csrf } })
  if (!response.ok && response.status !== 401) throw new Error(await detail(response))
}

async function profileResponse(response: Response): Promise<Profile> {
  if (!response.ok) throw new Error(await detail(response))
  return response.json()
}

export async function saveProfile(csrf: string, fullName: string, phone: string): Promise<Profile> {
  return profileResponse(await fetch(`${API_BASE_URL}/auth/profile`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }, body: JSON.stringify({ full_name: fullName, phone }) }))
}

export async function savePhoto(csrf: string, photo: File | null): Promise<Profile> {
  if (!photo) return profileResponse(await fetch(`${API_BASE_URL}/auth/profile/photo`, { method: 'DELETE', headers: { 'X-CSRF-Token': csrf } }))
  const body = new FormData()
  body.append('photo', photo)
  return profileResponse(await fetch(`${API_BASE_URL}/auth/profile/photo`, { method: 'PUT', headers: { 'X-CSRF-Token': csrf }, body }))
}

export function photoUrl(version: number): string {
  return `${API_BASE_URL}/auth/profile/photo?v=${version}`
}

export type PartnerKey = { id: string; name: string; created_at: number; last_used_at: number | null; revoked_at: number | null; key?: string }

export async function fetchPartnerKeys(): Promise<PartnerKey[]> {
  const response = await fetch(`${API_BASE_URL}/auth/partner-keys`)
  if (!response.ok) throw new Error(await detail(response))
  return response.json()
}

export async function createPartnerKey(csrf: string, name: string): Promise<PartnerKey> {
  const response = await fetch(`${API_BASE_URL}/auth/partner-keys`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }, body: JSON.stringify({ name }) })
  if (!response.ok) throw new Error(await detail(response))
  return response.json()
}

export async function revokePartnerKey(csrf: string, id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/auth/partner-keys/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { 'X-CSRF-Token': csrf } })
  if (!response.ok) throw new Error(await detail(response))
}
