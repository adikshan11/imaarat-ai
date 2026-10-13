const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

export type ChatPage = 'dashboard' | 'new' | 'paper' | 'how'

export interface ChatTurn {
  role: 'user' | 'assistant'
  text: string
}

export interface ChatReply {
  code: 'ok' | 'offline' | 'limit'
  reply: string | null
  page: ChatPage | null
  language: string | null
  sources: Array<{ id: string; title: string }>
}

const NONE: Omit<ChatReply, 'code'> = { reply: null, page: null, language: null, sources: [] }

export async function askSaathi(message: string, language: string, history: ChatTurn[]): Promise<ChatReply> {
  const response = await fetch(`${API_BASE_URL}/assistant/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, language, history }),
  })
  if (response.status === 429) return { code: 'limit', ...NONE }
  if (!response.ok) throw new Error('The assistant could not answer')
  return (await response.json()) as ChatReply
}
