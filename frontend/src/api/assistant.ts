const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

export type ChatPage = 'dashboard' | 'new' | 'paper' | 'how'

export interface ChatTurn {
  role: 'user' | 'assistant'
  text: string
}

export interface ChatReply {
  code: 'ok' | 'offline' | 'limit' | 'refused'
  reply: string | null
  page: ChatPage | null
  language: string | null
  sources: Array<{ id: string; title: string }>
  followups: string[]
}

const NONE: Omit<ChatReply, 'code'> = { reply: null, page: null, language: null, sources: [], followups: [] }

export async function askSaathi(message: string, language: string, history: ChatTurn[]): Promise<ChatReply> {
  const response = await fetch(`${API_BASE_URL}/assistant/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, language, history }),
    signal: AbortSignal.timeout(25000),
  })
  if (response.status === 429) return { code: 'limit', ...NONE }
  if (!response.ok) throw new Error('The assistant could not answer')
  return (await response.json()) as ChatReply
}

export async function fetchSpeech(text: string, language: string, signal: AbortSignal): Promise<{ audio: Blob | null; off: boolean }> {
  try {
    const response = await fetch(`${API_BASE_URL}/assistant/speak`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, language }),
      signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]),
    })
    if (response.ok) return { audio: await response.blob(), off: false }
    return { audio: null, off: [401, 429, 503].includes(response.status) }
  } catch {
    return { audio: null, off: false }
  }
}
