export type Tool = { name: string; href: string; path?: string; src?: string; wide?: boolean; wordmark?: boolean }

const MCP_PATH =
  'M13.85 0a4.16 4.16 0 0 0-2.95 1.217L1.456 10.66a.835.835 0 0 0 0 1.18.835.835 0 0 0 1.18 0l9.442-9.442a2.49 2.49 0 0 1 3.541 0 2.49 2.49 0 0 1 0 3.541L8.59 12.97l-.1.1a.835.835 0 0 0 0 1.18.835.835 0 0 0 1.18 0l.1-.098 7.03-7.034a2.49 2.49 0 0 1 3.542 0l.049.05a2.49 2.49 0 0 1 0 3.54l-8.54 8.54a1.96 1.96 0 0 0 0 2.755l1.753 1.753a.835.835 0 0 0 1.18 0 .835.835 0 0 0 0-1.18l-1.753-1.753a.266.266 0 0 1 0-.394l8.54-8.54a4.185 4.185 0 0 0 0-5.9l-.05-.05a4.16 4.16 0 0 0-2.95-1.218c-.2 0-.401.02-.6.048a4.17 4.17 0 0 0-1.17-3.552A4.16 4.16 0 0 0 13.85 0m0 3.333a.84.84 0 0 0-.59.245L6.275 10.56a4.186 4.186 0 0 0 0 5.902 4.186 4.186 0 0 0 5.902 0L19.16 9.48a.835.835 0 0 0 0-1.18.835.835 0 0 0-1.18 0l-6.985 6.984a2.49 2.49 0 0 1-3.54 0 2.49 2.49 0 0 1 0-3.54l6.983-6.985a.835.835 0 0 0 0-1.18.84.84 0 0 0-.59-.245'

export const stack: Tool[] = [
  { name: 'React', href: 'https://react.dev', src: '/landing/stack/react.svg' },
  { name: 'FastAPI', href: 'https://fastapi.tiangolo.com', src: '/landing/stack/fastapi.svg' },
  { name: 'LangGraph', href: 'https://www.langchain.com/langgraph', src: '/landing/stack/langgraph.svg', wide: true },
  { name: 'Qdrant', href: 'https://qdrant.tech', src: '/landing/stack/qdrant.svg' },
  { name: 'PostgreSQL', href: 'https://www.postgresql.org', src: '/landing/stack/postgresql.svg' },
  { name: 'MCP', href: 'https://modelcontextprotocol.io', path: MCP_PATH },
  { name: 'A2A', href: 'https://a2a-protocol.org', src: '/landing/stack/a2a.svg' },
  { name: 'Langfuse', href: 'https://langfuse.com', src: '/landing/stack/langfuse.svg' },
  { name: 'DeepEval', href: 'https://deepeval.com', src: '/landing/stack/deepeval.svg', wordmark: true },
  { name: 'Sarvam AI', href: 'https://www.sarvam.ai', src: '/landing/stack/sarvam.svg' },
  { name: 'dbt', href: 'https://www.getdbt.com', src: '/landing/stack/dbt.svg' },
  { name: 'DuckDB', href: 'https://duckdb.org', src: '/landing/stack/duckdb.svg' },
  { name: 'Vercel', href: 'https://vercel.com', path: 'm12 1.608 12 20.784H0Z' },
  { name: 'Google Gemini', href: 'https://ai.google.dev/gemini-api', src: '/landing/stack/gemini.svg' },
]
