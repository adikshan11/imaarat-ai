import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { securityClient } from '@/api/session'
import { SecurityError } from '@/api/security_client.mjs'
import { useSession } from '@/context/SessionContext'
import './account.css'

interface Connection {
  id: string
  owner_id: string
  provider: 'gemini'
  suffix: string | null
  state: string
  version: number
}
interface TokenMetadata { id: string; scopes: string[]; expires_at: number }

export default function AccountPanel() {
  const { identity, loading, error, revision, refresh, guest, login, logout } = useSession()
  const [open, setOpen] = useState(false)
  return <section className="account-shell" lang="en" aria-label="Secure account">
    <button type="button" aria-expanded={open} aria-controls="secure-account" onClick={() => setOpen(!open)}>Account and connections</button>
    <span role="status">{loading ? 'Checking secure session…' : identity ? `${identity.role} · ${identity.data_policy}` : 'No verified session'}</span>
    {open && <div id="secure-account" className="account-panel">
      <h2>Secure account</h2>
      <p>Account controls are currently in English. Keys and tokens are not stored in browser storage. Enter real secrets only from a trusted personal device, never a managed work laptop.</p>
      {error && <p role="alert">{error}</p>}
      <div className="account-actions">
        <button disabled={loading} onClick={() => { void refresh() }}>Check session</button>
        <button disabled={loading} onClick={() => { void login() }}>{identity?.role !== 'guest' && identity ? 'Re-authenticate with GitHub' : 'Sign in with GitHub'}</button>
        {!identity && <button disabled={loading} onClick={() => { void guest() }}>Start synthetic guest session</button>}
        {identity && <button disabled={loading} onClick={() => { void logout() }}>Sign out</button>}
      </div>
      {identity?.role === 'guest' && <p>Guest access is limited to curated synthetic data. Do not upload private documents.</p>}
      {identity && identity.role !== 'guest' && <ConnectionControls key={`${identity.owner_id}:${revision}`} ownerId={identity.owner_id} />}
      <p>Sign-out clears browser-owned results. Issued integration tokens remain active until revoked or expired. A failed sign-out does not prove remote session revocation.</p>
    </div>}
  </section>
}

function ConnectionControls({ ownerId }: { ownerId: string }) {
  const [connections, setConnections] = useState<Connection[]>([])
  const [tokens, setTokens] = useState<TokenMetadata[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [issued, setIssued] = useState<string | null>(null)
  const credential = useRef<HTMLInputElement>(null)
  const mounted = useRef(true)
  const admission = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; if (credential.current) credential.current.value = '' } }, [])
  const execute = async (operation: () => Promise<void>) => {
    if (admission.current) return
    admission.current = true
    setBusy(true)
    setMessage(null)
    setIssued(null)
    try { await operation() }
    catch (cause) { if (mounted.current) setMessage(cause instanceof SecurityError ? cause.message : 'The service returned an invalid response.') }
    finally { admission.current = false; if (credential.current) credential.current.value = ''; if (mounted.current) setBusy(false) }
  }
  const listing = async () => {
    const [rows, grants] = await Promise.all([securityClient().request<Connection[]>('/connections'), securityClient().request<TokenMetadata[]>('/auth/tokens')])
    if (!Array.isArray(rows) || rows.length > 100 || rows.some((row) => row.owner_id !== ownerId || !/^[a-f0-9-]{36}$/.test(row.id) || row.provider !== 'gemini' || !Number.isInteger(row.version) || row.version < 1 || typeof row.state !== 'string' || row.state.length > 64 || (row.suffix !== null && (typeof row.suffix !== 'string' || row.suffix.length > 4)))) throw new SecurityError('response_invalid')
    if (!Array.isArray(grants) || grants.length > 10 || grants.some((row) => !/^[a-f0-9-]{36}$/.test(row.id) || !Array.isArray(row.scopes) || row.scopes.some((scope) => !['interop:read', 'interop:assess'].includes(scope)) || !Number.isSafeInteger(row.expires_at))) throw new SecurityError('response_invalid')
    if (mounted.current) { setConnections(rows); setTokens(grants) }
  }
  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const value = credential.current?.value ?? ''
    if (credential.current) credential.current.value = ''
    const selected = (form.elements.namedItem('connection') as HTMLSelectElement).value
    const row = connections.find((item) => item.id === selected)
    void execute(async () => {
      if (!/^[\x21-\x7e]{16,512}$/.test(value) || (selected && !row)) throw new SecurityError('request_input_invalid')
      await securityClient().request(row ? `/connections/${row.id}/replace` : '/connections', { method: 'POST', body: row ? { version: row.version, credential: value } : { provider: 'gemini', credential: value } })
      await listing()
      if (mounted.current) setMessage('Stored as unverified metadata. No AI provider was activated.')
    })
  }
  const change = (row: Connection, operation: 'disable' | 'delete') => {
    if (operation === 'delete' && !window.confirm('Destroy this stored credential? Provider-side revocation and backup retention are separate.')) return
    void execute(async () => {
      await securityClient().request(`/connections/${row.id}${operation === 'delete' ? '' : '/disable'}`, { method: operation === 'delete' ? 'DELETE' : 'POST', body: { version: row.version } })
      await listing()
    })
  }
  return <div className="account-controls">
    <h3>Connections and integration access</h3>
    <p>Sensitive actions require sign-in within the last five minutes. A stored key is not proof of provider verification. Provider verification and governed inference are not enabled yet.</p>
    <button disabled={busy} onClick={() => { void execute(listing) }}>Load current metadata</button>
    {message && <p role="status">{message}</p>}
    <form onSubmit={save} autoComplete="off">
      <label htmlFor="account-connection">Gemini connection</label>
      <select id="account-connection" name="connection" disabled={busy}><option value="">Create connection</option>{connections.map((row) => <option key={row.id} value={row.id}>Replace …{row.suffix ?? 'hidden'} · {row.state}</option>)}</select>
      <label htmlFor="account-credential">Provider credential</label>
      <input id="account-credential" ref={credential} type="password" autoComplete="off" spellCheck={false} minLength={16} maxLength={512} required disabled={busy} />
      <button disabled={busy} type="submit">Store in private broker</button>
    </form>
    <ul>{connections.map((row) => <li key={row.id}>Gemini …{row.suffix ?? 'hidden'} · {row.state}<div className="account-actions"><button disabled={busy} onClick={() => change(row, 'disable')}>Disable</button><button disabled={busy} onClick={() => change(row, 'delete')}>Destroy stored credential</button></div></li>)}</ul>
    <h3>Integration tokens</h3>
    <p>Create a read-only token for MCP/A2A ownership tests. Execution is still blocked. Never put this token in URLs, screenshots or logs.</p>
    <button disabled={busy} onClick={() => { void execute(async () => {
      const result = await securityClient().request<{ token: string }>('/auth/tokens', { method: 'POST', body: { scopes: ['interop:read'], lifetime: 3600 } })
      if (!/^[A-Za-z0-9_-]{43}$/.test(result.token)) throw new SecurityError('response_invalid')
      if (mounted.current) setIssued(result.token)
    }) }}>Create one-hour read token</button>
    {issued && <div><label htmlFor="issued-token">Shown once. Copy manually on a trusted personal device.</label><input id="issued-token" type="password" autoComplete="off" readOnly value={issued} onFocus={(event) => event.currentTarget.select()} /><button onClick={() => setIssued(null)}>Dismiss token</button></div>}
    <ul>{tokens.map((row) => <li key={row.id}>{row.scopes.join(', ')} · expires {new Date(row.expires_at * 1000).toISOString()}<button disabled={busy} onClick={() => { void execute(async () => { await securityClient().request(`/auth/tokens/${row.id}`, { method: 'DELETE' }); await listing() }) }}>Revoke</button></li>)}</ul>
  </div>
}