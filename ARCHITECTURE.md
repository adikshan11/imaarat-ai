# Architecture

imaarat.ai is built in layers. Each layer talks only to the one below it, so any part can be replaced without touching the rest. The rules on this page are enforced by tests, not just described.

```mermaid
flowchart TD
    UI["Web app and landing page<br/>frontend/"] --> API
    Agents["AI agents and other systems<br/>MCP · A2A · REST"] --> API
    API["API<br/>app/api"] --> WF["Underwriting workflow<br/>app/agents/graph.py (LangGraph)"]
    WF --> C1["Paper reader"] & C2["Hazard verification"] & C3["Rule engine"] & C4["Photo review"] & C5["Guideline search"] & C6["AI risk summary"]
    C1 & C4 & C5 & C6 --> GW["AI gateway<br/>app/llm.py<br/>budgets · retries · deadline · tracing"]
    GW --> P["Provider adapters<br/>app/providers/<br/>gemini.py · (bedrock.py · openai.py …)"]
    C2 & C3 --> DATA["Public hazard data<br/>backend/data/hazard"]
    API & WF --> PLAT["Platform services<br/>db · budget · telemetry · auth"]
```

## The layers

| Layer | Where | What it owns | What it must not do |
|---|---|---|---|
| Interfaces | `app/api`, `app/interop.py` | HTTP, MCP and A2A; sign-in; input validation | contain underwriting logic |
| Workflow | `app/agents/graph.py` | the order of steps, the review pause, checkpoints | call a model directly |
| Components | `app/tools/`, `app/agents/report_agent.py`, `app/reports.py` | one underwriting job each: read a form, check hazards, score, review a photo, search guidelines, write the summary, build the PDF | import a vendor SDK |
| AI gateway | `app/llm.py` | every model call: daily and per-minute budgets, retries for busy errors only, the per-request deadline, tracing and token accounting | know which vendor it is talking to |
| Providers | `app/providers/` | translating one vendor's SDK into the shared contract, and its errors into `ProviderError` | apply budgets, retries or business rules |
| Platform | `app/db.py`, `app/budget.py`, `app/telemetry.py`, `app/auth.py` | storage, spending limits, request and trace records, sessions | depend on the layers above |

## Agent map

Three ways in, one workflow, one rule engine. Each door exists for a different caller and a different length of conversation.

```mermaid
flowchart LR
    subgraph callers["Who calls"]
        U["Underwriter or broker<br/>in the web app"]
        AI["AI assistant<br/>Claude, ChatGPT, Copilot"]
        P["Partner agent<br/>broker, insurer, surveyor"]
        S["Your own system"]
    end
    U & S -->|REST| API
    AI -->|"MCP: one question, one answer"| MCP["MCP tools<br/>assess_property · lookup_hazard<br/>search_guidelines · get_assessment<br/>list_assessments"]
    P -->|"A2A: a case that may wait for a person"| A2A["A2A agent<br/>assess_property task<br/>underwriting_guidance"]
    API["REST API"] --> WF
    A2A --> WF
    MCP -->|"rules only, nothing stored"| RULES
    subgraph WF["Underwriting workflow (LangGraph)"]
        direction LR
        I[intake] --> X[read form and photo] --> G[guidelines] --> R[score] --> C[comparables] --> D[decide] --> M[AI summary] --> H{{"human review<br/>pauses on Refer"}}
    end
    R --- RULES["Rule engine<br/>decides every case"]
    H -->|signs off| REV["Signed-in reviewer"]
    WF --> DB[("Assessments and<br/>workflow checkpoints")]
    A2A -. "tasks/get reads the stored case" .-> DB
```

| Door | For | Conversation | State |
|---|---|---|---|
| REST | the web app and your own systems | one request each | stored assessments |
| MCP | AI assistants that need a fact or a score now | one call, one answer | none; `assess_property` stores nothing |
| A2A | another organisation's agent handing over a proposal | a task that can stay open for days | the stored assessment and its paused workflow |

A2A task lifecycle, matching how a commercial fire or industrial all-risk proposal moves between a broker and an insurer:

```mermaid
stateDiagram-v2
    [*] --> submitted: broker agent sends proposal facts
    submitted --> rejected: required facts missing (list returned)
    submitted --> working: rules score the case
    working --> completed: Accept or Decline decided by the rules
    working --> working: Refer, waiting for an underwriter
    working --> completed: underwriter signs off in the app
    completed --> [*]
    rejected --> [*]
```

### Memory and database for A2A tasks

| Layer | Holds | Why |
|---|---|---|
| Memory (per serverless instance) | A task while its request runs, then a cached copy for 15 minutes | The A2A library reads and writes the task several times per request; a database round trip each time would add latency for nothing |
| Postgres (shared) | The assessment row and its workflow checkpoint, which carry the task id in their thread id | The only copy that survives a restart, is shared by every instance, and changes when a reviewer signs off |

The pattern is a read-through cache with a time to live. A settled or waiting task is always re-read from Postgres, so a sign-off made on another instance is never hidden by a stale memory copy, and the 15-minute expiry stops memory growing on a long-running container. A separate task table was rejected: it would be a second source of truth that can drift from the assessment. Review claims use the other classic pattern, a lease: a reviewer holds a referral for 30 minutes (`claim_expires`), and if they leave, the lease lapses and someone else can take it, with no lock to clean up.

Partner isolation: A2A calls need an `X-API-Key` (stored hashed), the partner name becomes the task owner, and it is also part of the thread id, so one partner cannot read another's tasks even from the database. Results say they are indicative, not a quote or a binding decision. Push notifications and streaming are off: a serverless function cannot hold a connection open or send work after it replies.

## Why each part exists

| Part | Used for | What breaks without it |
|---|---|---|
| FastAPI | REST routes, validation, one ASGI app that also mounts MCP and A2A | Hand-written request parsing and no shared middleware |
| Pydantic | Request, memo and vision schemas | The model's JSON could not be checked before use |
| LangGraph + Postgres checkpointer | Fixed workflow steps and the pause for human review | A referral could not wait days for a reviewer and resume where it stopped |
| SQLAlchemy + psycopg | One data layer for Postgres in production and SQLite in tests | Two code paths for storage |
| Neon Postgres | Assessments, checkpoints, sessions, AI budget counters | No state across serverless instances |
| Gemini through `app/llm.py` | Form reading, photo review, embeddings, summaries | Only the rules run; the app degrades, it does not fail |
| Qdrant (optional) | Vector search over guideline sections | Falls back to vectors cached in Postgres, fine for 12 sections |
| MCP SDK | Read-only tools for AI assistants | Assistants could not call the engine |
| A2A SDK | Tasks for partner agents that can wait for a human | Partners would have to poll an ad-hoc API |
| Langfuse | Traces of each step with contact details masked | No way to see which step was slow or failed |
| React + Vite | The app and the prerendered landing page | |
| Vercel | Hosting of the static site and one Python function | |
| GitHub Actions | Tests, linters, secret scan, deploys, benchmarks | Nothing would stop a broken release |
| dbt + pipeline | Analytics tables built from the assessments | No reporting layer |

## Guideline search (RAG)

- Corpus: one reviewed Markdown file of 12 underwriting guideline sections (about 5,200 characters). There are no PDFs or scraped pages, so there is no PDF parsing step to get wrong.
- Chunking: one chunk per section, split on section headings, so a chunk never cuts a rule in half. Fixed-size or overlapping chunks would only help for long documents.
- Embeddings: Gemini `gemini-embedding-001`, with separate document and query task types.
- Query: the workflow searches after the rule engine has scored, so the query starts with the risk flags in words, then the main facts, distances and the decision criteria. Before, the query held only the facts and missed most drivers.
- Search: hybrid. Cosine similarity over the embeddings (in Qdrant when configured, otherwise over vectors cached in Postgres) and BM25 keyword scoring rank all 12 sections, and reciprocal rank fusion merges the two lists. The workflow keeps the top 4, MCP and A2A the top 3. With 12 sections an exact scan is faster than any index. k-means or HNSW indexes pay off only at thousands of chunks.
- Freshness: the index is keyed by a hash of the corpus and rebuilt when the file changes.
- Measured: the live eval retrieves for all 24 golden cases through the same code the app uses, and needs a hit rate of 1.0 at k=4. The cases are rule specifications, not labelled real proposals.

## Rules that CI enforces

`backend/tests/test_architecture.py` fails the build if:

1. any file outside `app/providers/` imports a vendor SDK (Google GenAI, OpenAI, Anthropic, boto3 for Bedrock, Sarvam, Mistral, Cohere);
2. any file outside `app/providers/` imports a specific adapter instead of `app.providers`;
3. a registered adapter's `generate`, `count_tokens` or `embed` signature differs from the contract in `app/providers/base.py`;
4. an unknown `AI_PROVIDER` does anything other than fail with the list of known providers.

## The provider contract

```python
class Provider(Protocol):
    name: str
    def generate(self, model, contents, *, system, schema, thinking, temperature, max_output_tokens) -> Reply: ...
    def count_tokens(self, model, text) -> int: ...
    def embed(self, model, texts, task) -> list[list[float]]: ...
```

- `contents` is a list of text and `ImageInput(data, mime_type)`; adapters convert images to their vendor's format.
- `Reply` carries the text and the input, output and thinking token counts. Output tokens include thinking, because that is what vendors bill.
- Every vendor error becomes `ProviderError(message, code, daily_quota)`. The gateway retries only codes 429, 500 and 503, never a spent daily quota, and only while the request's deadline allows.

## Swapping or adding a provider

Switching models within a provider is configuration only: set `AI_MODEL` and `AI_EMBEDDING_MODEL`.

Adding a provider, for example Amazon Bedrock:

1. Create `backend/app/providers/bedrock.py` with a `BedrockProvider` class whose `name` is `"bedrock"` and whose three methods follow the contract. Convert `ImageInput` to Bedrock's image block, and raise `ProviderError` with the HTTP status for throttling and server errors.
2. Add `"bedrock": "app.providers.bedrock:BedrockProvider"` to `ADAPTERS` in `backend/app/providers/__init__.py`, and its SDK to `requirements.txt`.
3. Deploy with `AI_PROVIDER=bedrock`, `AI_MODEL=<model id>`, `AI_EMBEDDING_MODEL=<embedding model id>` and the provider's credentials.
4. Run the evaluation and the form benchmark against it before switching production. A new provider changes accuracy, latency, cost and data terms, so it is measured, not assumed.

Nothing else changes: the components, workflow, budgets, retries, tracing and status page work the same.

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `AI_PROVIDER` | `gemini` | which adapter in `app/providers/` to use |
| `AI_API_KEY` | falls back to `GEMINI_API_KEY` | the selected provider's key |
| `AI_MODEL` | falls back to `GEMINI_MODEL`, then `gemini-3.8-flash` | the generation and vision model |
| `AI_EMBEDDING_MODEL` | `models/gemini-embedding-001` | the guideline-search embedding model |
| `AI_JUDGE_MODEL` | falls back to `GEMINI_FALLBACK_MODEL` | the evaluation judge |
| `AI_DAILY_GENERATIONS`, `AI_MINUTE_GENERATIONS` | 20, 5 | spending limits, matched to the provider's quota |

## Keeping the AI honest

| Concern | How it is handled |
|---|---|
| Structured output | JSON-schema mode with Pydantic models for the summary and photo review, then a mechanical check: the decision must match the rule engine, risk factors must be real flags, citations must be sections that were retrieved, and no invented amounts, rates or regulations. |
| One model, honest failure | Each call uses only the configured model. Busy errors (429, 500, 503) are retried at most once; a spent daily quota is never retried. There is no fallback model. When AI is unavailable the rules still decide, and the page says why in plain words. |
| Guideline search | Guidelines G1–G12 are embedded with `gemini-embedding-001` and stored in Postgres (or Qdrant when configured), re-indexed when the text changes. |
| Evals | A 24-property golden set measures decision accuracy, retrieval hit rate and recall, the summary contract, citation precision, and faithfulness through a DeepEval judge. TOON and JSON prompts are compared on the same cases. |
| Tracing | Langfuse records every workflow step and model call with tokens and latency; each assessment links to its trace. |
| Human review | LangGraph `interrupt()` pauses referrals and Postgres checkpoints let a reviewer resume them later. A claim holds a referral for 30 minutes, and the decision is saved with one conditional update, so two reviewers can never both decide it. |

## AI budget

Every AI call is paid for from a daily budget before it is made, so the public demo cannot exhaust the provider quota or run up a bill.

- **Who gets AI:** every browser visitor, demo or signed in, gets the AI risk summary and paper-form reading while the shared daily allowance lasts. Setting `AI_SIGN_IN_REQUIRED=true` limits live AI to signed-in sessions. MCP and A2A always get the rule-engine decision with the AI stages skipped and a note saying why, so they never take a budget slot.
- **Profiles:** a signed-in user must save a full name and mobile number (E.164, Indian numbers normalised to +91) before the app opens, and the server refuses reviews until the profile is complete. The optional photo is decoded with Pillow, cropped to 256 px and re-encoded as WebP, which drops EXIF and any embedded payload; it is served only to its owner.
- **Admission:** each assessment or form reading takes one slot from a global daily cap (`AI_DAILY_ADMISSIONS`, 15) and a per-visitor cap (`AI_CLIENT_DAILY_ADMISSIONS`, 3). Visitors are counted by a daily-rotating hash of their address, never the address itself.
- **Calls:** every attempt, including retries, takes one call from `AI_DAILY_CALLS` (200). Text and image generations also count against `AI_DAILY_GENERATIONS` (20) and `AI_MINUTE_GENERATIONS` (5), matched to the free tier of gemini-3.8-flash.
- **Atomic:** a reservation is one `UPDATE … SET used = used + n WHERE used + n <= cap`, so concurrent servers never overspend; CI proves it with 20 parallel requests on real Postgres.
- **Fail closed:** on Vercel, AI runs only when the budget lives in Postgres. `/api/status` shows what is left.

## Data pipeline

```
Postgres ──extract──▶ Parquet ──dbt build──▶ DuckDB marts ──publish──▶ Postgres snapshot ──▶ dashboard
```

- The pipeline follows the medallion pattern. Bronze: `extract.py` copies the operational tables as they are into Parquet in `pipeline/lake/`. Silver: dbt staging views parse the stored JSON, cast types and normalise PIN codes and decisions. Gold: `fct_assessments` and the marts are tables built for the dashboard.
- Staging models feed `fct_assessments` and marts for catastrophe exposure, city accumulation, risk drivers, the review funnel, reference benchmarks and declared-versus-official hazards.
- dbt tests check keys, accepted values, score ranges, that each stored decision matches its score band, and that every override has a reason.
- `pipeline/hazard/build_hazard.py` builds the PIN-code hazard table from the open sources listed in the README, and fails if IMD's published district counts do not match.

## Framework choices

- **LangGraph**, not CrewAI or AutoGen: underwriting needs fixed steps, checkpoints and human interrupts, not autonomous agent crews.
- **Langfuse**, not LangSmith: open source, built on OpenTelemetry, with a larger free tier.
- **DeepEval** for judged metrics: maintained and pytest-style.
- **Not used:** visual builders such as n8n and Langflow hide the engineering; LlamaIndex adds little for a 12-section corpus.

## Deployment

```mermaid
flowchart LR
  subgraph gha["GitHub Actions"]
    ci["CI/CD<br/><small>Check → Test → Deploy</small>"]
    nightly["Nightly ELT"]
  end
  subgraph vercel["Vercel, sin1"]
    static["Static pages<br/><small>landing · app · legal</small>"]
    fn["Python function<br/><small>api/index.py → /api</small>"]
  end
  neon[("Neon Postgres<br/>Singapore")]
  pages["GitHub Pages<br/><small>dbt docs</small>"]
  ci -- "vercel deploy, smoke test" --> static & fn
  fn --> neon
  nightly --> neon
  nightly --> pages
  classDef box fill:#14532d,stroke:#6ee7b7,color:#fff
  class ci,nightly,static,fn,pages box
```

The same code also runs in Docker: `compose.yaml` starts Postgres, the API and nginx serving the website, and CI builds and smoke-tests that stack on every pull request.
