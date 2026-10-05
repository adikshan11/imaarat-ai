import { createSecurityClient } from './security_client.mjs'
import type { SecurityClient } from './security_client.mjs'

let client: SecurityClient | null = null
const listeners = new Set<() => void>()

export function securityClient() {
  client ??= createSecurityClient({ origin: window.location.origin, fetch: window.fetch.bind(window), onSessionLost: () => { listeners.forEach((listener) => listener()) } })
  return client
}

export function onSessionLost(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}