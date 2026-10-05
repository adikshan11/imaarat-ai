import assert from 'node:assert/strict'
import test from 'node:test'
import { createSecurityClient, approvedLogin } from '../src/api/security_client.mjs'

const origin = 'https://example.test'
const session = { owner_id: '00000000-0000-4000-8000-000000000001', role: 'member', data_policy: 'private_local', csrf_token: 'a'.repeat(64) }

test('session mutations bind same origin, cookie and memory-only CSRF', async () => {
  const calls = []
  const client = createSecurityClient({ origin, fetch: async (url, options) => {
    calls.push({ url, options })
    return new Response(JSON.stringify(session), { headers: { 'Content-Type': 'application/json' } })
  } })
  await client.session()
  await client.request('/connections', { method: 'POST', body: { provider: 'gemini', credential: 'test-canary-credential' } })
  assert.equal(calls[1].url, origin + '/api/connections')
  assert.equal(calls[1].options.credentials, 'same-origin')
  assert.equal(calls[1].options.cache, 'no-store')
  assert.equal(calls[1].options.redirect, 'error')
  assert.equal(calls[1].options.headers['X-CSRF-Token'], session.csrf_token)
  client.clear()
  await assert.rejects(client.request('/connections', { method: 'POST', body: {} }), { code: 'authentication_required' })
})

test('reject query secrets, foreign destinations and privileged routes before fetch', async () => {
  let calls = 0
  const client = createSecurityClient({ origin, fetch: async () => { calls++; return new Response('{}') } })
  for (const path of ['//evil.test', '/connections?credential=canary', '/connections#canary', '/admin', '/connections/%2e%2e']) {
    await assert.rejects(client.request(path), { code: 'request_input_invalid' })
  }
  assert.equal(calls, 0)
  assert.throws(() => createSecurityClient({ origin: 'http://example.test' }))
})

test('response failures never expose server credential or body details', async () => {
  const client = createSecurityClient({ origin, fetch: async () => new Response(JSON.stringify({ detail: 'secret-canary-provider-error' }), { status: 503 }) })
  await assert.rejects(client.session(), (error) => error.code === 'service_unavailable' && !error.message.includes('canary'))
})

test('session expiry clears CSRF and publishes an auth-loss event', async () => {
  let lost = 0
  let expired = false
  const client = createSecurityClient({ origin, onSessionLost: () => { lost++ }, fetch: async () => expired ? new Response('{}', { status: 401 }) : new Response(JSON.stringify(session)) })
  await client.session()
  expired = true
  await assert.rejects(client.request('/connections'), { code: 'authentication_required' })
  assert.equal(lost, 1)
  await assert.rejects(client.request('/connections', { method: 'POST', body: {} }), { code: 'authentication_required' })
})

test('bound response bodies and request lifetimes', async () => {
  const large = createSecurityClient({ origin, maxResponseBytes: 32, fetch: async () => new Response(JSON.stringify({ data: 'x'.repeat(64) })) })
  await assert.rejects(large.session(), { code: 'response_invalid' })
  const stalled = createSecurityClient({ origin, timeoutMs: 10, fetch: async (url, options) => new Promise((resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true })
  }) })
  await assert.rejects(stalled.session(), { code: 'request_timeout' })
})

test('OAuth redirect is only the fixed GitHub authorization endpoint', () => {
  const accepted = 'https://github.com/login/oauth/authorize?client_id=test&state=test'
  assert.equal(approvedLogin(accepted), accepted)
  for (const url of ['javascript:alert(1)', 'https://github.com.evil.test/login/oauth/authorize', 'https://user@github.com/login/oauth/authorize', 'https://github.com/login/oauth/authorize#canary', 'https://github.com/other']) {
    assert.throws(() => approvedLogin(url))
  }
})