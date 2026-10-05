const messages = {
  authentication_required: 'Sign in or start a guest session to continue.',
  authorization_required: 'This action needs permission or a recent sign-in.',
  request_input_invalid: 'The request is not permitted.',
  state_conflict: 'The state changed. Refresh before retrying.',
  request_too_large: 'The request is too large.',
  rate_limited: 'Too many requests. Try again later.',
  service_unavailable: 'The secure service is unavailable. No alternate service was used.',
  response_invalid: 'The service returned an invalid response.',
  request_timeout: 'The request deadline expired. Its remote outcome may still need checking.',
  session_changed: 'The session changed. Refresh before continuing.',
}

export class SecurityError extends Error {
  constructor(code, status = 0) {
    super(messages[code] ?? messages.service_unavailable)
    this.name = 'SecurityError'
    this.code = code
    this.status = status
  }
}

export function approvedLogin(value) {
  const url = new URL(value)
  if (url.origin !== 'https://github.com' || url.pathname !== '/login/oauth/authorize' || url.username || url.password || url.hash) throw new SecurityError('response_invalid')
  return url.href
}

export function createSecurityClient({ origin, fetch: transport, onSessionLost = () => {}, timeoutMs = 15000, maxResponseBytes = 1048576, maxRequestBytes = 262144, maxFileBytes = 4000000 }) {
  const base = new URL(origin)
  if (base.protocol !== 'https:' || base.origin !== origin || base.username || base.password || [timeoutMs, maxResponseBytes, maxRequestBytes, maxFileBytes].some((value) => !Number.isSafeInteger(value) || value < 1)) throw new SecurityError('request_input_invalid')
  let csrf = null
  let generation = 0
  let verified = 0
  let bootstrap = 0
  let identity = null
  const clear = () => { csrf = null; generation++ }
  const expire = () => { clear(); onSessionLost() }
  const allowed = /^(?:\/auth\/(?:session|guest|logout|github\/start|tokens(?:\/[a-f0-9-]{36})?)|\/connections(?:\/[a-f0-9-]{36}(?:\/(?:replace|disable|verify))?)?|\/(?:health|status)|\/underwrite\/(?:history(?:\/[1-9][0-9]*(?:\/report\.pdf|\/review)?)?|submit|preview|read-form|analytics|evals))$/

  async function request(path, { method = 'GET', body, format = 'json' } = {}) {
    if (typeof path !== 'string' || !allowed.test(path) || !['GET', 'POST', 'DELETE'].includes(method) || !['json', 'blob'].includes(format) || (method === 'GET' && body !== undefined)) throw new SecurityError('request_input_invalid')
    const mutates = method !== 'GET'
    if (mutates && !csrf && !['/auth/guest', '/auth/github/start'].includes(path)) throw new SecurityError('authentication_required')
    const current = generation
    const checked = verified
    const multipart = typeof FormData !== 'undefined' && body instanceof FormData
    const encoded = body === undefined ? undefined : multipart ? body : JSON.stringify(body)
    if (!multipart && encoded !== undefined && new TextEncoder().encode(encoded).byteLength > maxRequestBytes) throw new SecurityError('request_too_large')
    if (multipart) {
      let files = 0
      let fields = 0
      let size = 0
      for (const [name, value] of body.entries()) {
        size += new TextEncoder().encode(name).byteLength + 512
        if (typeof value === 'string') {
          fields++
          const length = new TextEncoder().encode(value).byteLength
          if (length > 4096) throw new SecurityError('request_too_large')
          size += length
        } else {
          files++
          if (value.size > maxFileBytes) throw new SecurityError('request_too_large')
          size += value.size + new TextEncoder().encode(value.name).byteLength
        }
      }
      if (files > 1 || fields > 100 || size > 4200000) throw new SecurityError('request_too_large')
    }
    const controller = new AbortController()
    let timer
    let reader
    const deadline = new Promise((resolve, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new SecurityError('request_timeout')) }, timeoutMs)
    })
    try {
      return await Promise.race([deadline, (async () => {
        const headers = { Accept: format === 'blob' ? 'application/pdf' : 'application/json' }
        if (mutates && csrf) headers['X-CSRF-Token'] = csrf
        if (body !== undefined && !multipart) headers['Content-Type'] = 'application/json'
        const response = await transport(origin + '/api' + path, {
          method, headers, body: encoded,
          credentials: 'same-origin', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer', signal: controller.signal,
        })
        if (current !== generation) throw new SecurityError('session_changed')
        if (!response.ok) {
          await response.body?.cancel()
          if (current !== generation || (response.status === 401 && checked !== verified)) throw new SecurityError('session_changed')
          if (response.status === 401) expire()
          const codes = { 401: 'authentication_required', 403: 'authorization_required', 404: 'request_input_invalid', 409: 'state_conflict', 413: 'request_too_large', 422: 'request_input_invalid', 429: 'rate_limited' }
          throw new SecurityError(codes[response.status] ?? 'service_unavailable', response.status)
        }
        if (response.status === 204) return null
        const declared = response.headers.get('Content-Length')
        if (declared && (!/^\d+$/.test(declared) || Number(declared) > maxResponseBytes)) throw new SecurityError('response_invalid')
        const chunks = []
        let size = 0
        reader = response.body?.getReader()
        if (!reader) throw new SecurityError('response_invalid')
        while (true) {
          const { value, done } = await reader.read()
          if (current !== generation) throw new SecurityError('session_changed')
          if (done) break
          size += value.byteLength
          if (size > maxResponseBytes) throw new SecurityError('response_invalid')
          chunks.push(value)
        }
        const payload = new Blob(chunks, { type: response.headers.get('Content-Type') ?? '' })
        if (format === 'blob') {
          if (!payload.type.startsWith('application/pdf')) throw new SecurityError('response_invalid')
          return payload
        }
        const value = JSON.parse(await payload.text())
        if (current !== generation) throw new SecurityError('session_changed')
        return value
      })()])
    } catch (error) {
      if (error instanceof SecurityError) throw error
      throw new SecurityError(controller.signal.aborted ? 'request_timeout' : 'service_unavailable')
    } finally {
      clearTimeout(timer)
      controller.abort()
      if (reader) void reader.cancel().catch(() => {})
    }
  }

  async function session(guest = false) {
    const operation = ++bootstrap
    const current = generation
    const value = await request(guest ? '/auth/guest' : '/auth/session', guest ? { method: 'POST' } : {})
    if (current !== generation || operation !== bootstrap) throw new SecurityError('session_changed')
    if (!value || !/^[a-f0-9-]{36}$/.test(value.owner_id) || !['guest', 'member', 'reviewer', 'operator'].includes(value.role) || !['synthetic', 'private_local'].includes(value.data_policy) || !/^[a-f0-9]{64}$/.test(value.csrf_token) || !Number.isSafeInteger(value.expires_at) || value.expires_at <= Date.now() / 1000) throw new SecurityError('response_invalid')
    const marker = `${value.owner_id}:${value.role}:${value.data_policy}`
    if (csrf !== value.csrf_token || identity !== marker) generation++
    identity = marker
    csrf = value.csrf_token
    verified++
    return { owner_id: value.owner_id, role: value.role, data_policy: value.data_policy, expires_at: value.expires_at, epoch: generation }
  }
  return { request, session, clear, expire }
}