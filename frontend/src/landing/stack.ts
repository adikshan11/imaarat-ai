export type Tool = { name: string; role: string; href: string; path?: string; color?: string; src?: string; wide?: boolean }

export const aiStack: Tool[] = [
  { name: 'Google Gemini', role: 'LLM, vision and embeddings', href: 'https://ai.google.dev/gemini-api', src: '/landing/stack/gemini.svg' },
  { name: 'LangGraph', role: 'Agent workflow with human review', href: 'https://www.langchain.com/langgraph', src: '/landing/stack/langgraph.svg', wide: true },
  { name: 'Qdrant', role: 'Vector database', href: 'https://qdrant.tech', src: '/landing/stack/qdrant.svg' },
  { name: 'MCP', role: 'Tools for AI assistants', href: 'https://modelcontextprotocol.io', path: 'M13.85 0a4.16 4.16 0 0 0-2.95 1.217L1.456 10.66a.835.835 0 0 0 0 1.18.835.835 0 0 0 1.18 0l9.442-9.442a2.49 2.49 0 0 1 3.541 0 2.49 2.49 0 0 1 0 3.541L8.59 12.97l-.1.1a.835.835 0 0 0 0 1.18.835.835 0 0 0 1.18 0l.1-.098 7.03-7.034a2.49 2.49 0 0 1 3.542 0l.049.05a2.49 2.49 0 0 1 0 3.54l-8.54 8.54a1.96 1.96 0 0 0 0 2.755l1.753 1.753a.835.835 0 0 0 1.18 0 .835.835 0 0 0 0-1.18l-1.753-1.753a.266.266 0 0 1 0-.394l8.54-8.54a4.185 4.185 0 0 0 0-5.9l-.05-.05a4.16 4.16 0 0 0-2.95-1.218c-.2 0-.401.02-.6.048a4.17 4.17 0 0 0-1.17-3.552A4.16 4.16 0 0 0 13.85 0m0 3.333a.84.84 0 0 0-.59.245L6.275 10.56a4.186 4.186 0 0 0 0 5.902 4.186 4.186 0 0 0 5.902 0L19.16 9.48a.835.835 0 0 0 0-1.18.835.835 0 0 0-1.18 0l-6.985 6.984a2.49 2.49 0 0 1-3.54 0 2.49 2.49 0 0 1 0-3.54l6.983-6.985a.835.835 0 0 0 0-1.18.84.84 0 0 0-.59-.245', color: '#000000' },
  { name: 'A2A', role: 'Agent-to-agent API', href: 'https://a2a-protocol.org', src: '/landing/stack/a2a.svg' },
  { name: 'Langfuse', role: 'LLM tracing', href: 'https://langfuse.com', src: '/landing/stack/langfuse.svg' },
  { name: 'DeepEval', role: 'Faithfulness evals', href: 'https://deepeval.com' },
  { name: 'Hugging Face', role: 'Open vision model benchmark', href: 'https://huggingface.co', src: '/landing/stack/huggingface.svg' },
  { name: 'Sarvam AI', role: 'Indian-language benchmark', href: 'https://www.sarvam.ai' },
  { name: 'Python', role: 'Backend and data pipelines', href: 'https://www.python.org', src: '/landing/stack/python.svg' },
  { name: 'FastAPI', role: 'REST API', href: 'https://fastapi.tiangolo.com', src: '/landing/stack/fastapi.svg' },
  { name: 'Pydantic', role: 'Structured AI output', href: 'https://docs.pydantic.dev', src: '/landing/stack/pydantic.svg' },
  { name: 'SQLAlchemy', role: 'Database access', href: 'https://www.sqlalchemy.org', src: '/landing/stack/sqlalchemy.svg' },
  { name: 'PostgreSQL', role: 'Neon: data and agent checkpoints', href: 'https://www.postgresql.org', src: '/landing/stack/postgresql.svg' },
]

export const deliveryStack: Tool[] = [
  { name: 'React', role: 'Web app in 26 languages', href: 'https://react.dev', src: '/landing/stack/react.svg' },
  { name: 'TypeScript', role: 'Typed frontend', href: 'https://www.typescriptlang.org', src: '/landing/stack/typescript.svg' },
  { name: 'Vite', role: 'Frontend build', href: 'https://vite.dev', src: '/landing/stack/vite.svg' },
  { name: 'Tailwind CSS', role: 'Styling', href: 'https://tailwindcss.com', src: '/landing/stack/tailwindcss.svg' },
  { name: 'dbt', role: 'Analytics models', href: 'https://www.getdbt.com', src: '/landing/stack/dbt.svg' },
  { name: 'DuckDB', role: 'Analytics warehouse', href: 'https://duckdb.org', src: '/landing/stack/duckdb.svg' },
  { name: 'Docker', role: 'Container images', href: 'https://www.docker.com', src: '/landing/stack/docker.svg' },
  { name: 'GitHub Actions', role: 'CI/CD, evals and benchmarks', href: 'https://github.com/features/actions', src: '/landing/stack/githubactions.svg' },
  { name: 'Playwright', role: 'Browser tests', href: 'https://playwright.dev', src: '/landing/stack/playwright.svg' },
  { name: 'Lighthouse', role: 'Performance audits', href: 'https://developer.chrome.com/docs/lighthouse', src: '/landing/stack/lighthouse.svg' },
  { name: 'Vercel', role: 'Hosting', href: 'https://vercel.com', path: 'm12 1.608 12 20.784H0Z', color: '#000000' },
]
