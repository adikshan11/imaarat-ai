# UW Risk Copilot

AI-assisted commercial property underwriting for Indian commercial property. An underwriter enters a property, sees a live risk preview while typing, and gets an authoritative decision with evidence: Gemini Vision observations from the property photo, guideline excerpts retrieved by RAG, similar reference properties, a validated AI memo and a downloadable PDF report.

Built by **Pranjal Jain, Adithya Shankaran and Sanjeev Sharma** as the capstone of Xebia's Quantum Shift AI Practitioner+ program (August 2026), developed with GitHub Copilot custom agents and instructions.

## How it decides

The decision is never left to the model.

| Score | Decision |
|---|---|
| 0–30 | Accept |
| 31–60 | Refer |
| 61–84 | Decline (mitigation possible) |
| 85–100 | Auto-Decline |

- **Python owns the decision.** A deterministic rule set scores roof age, construction, sprinklers, CAT and seismic zones, coastal and wildland distance, loss history and insured value (`backend/app/tools/risk_calculator.py`).
- **Gemini only explains it.** The memo must return six fields, repeat the deterministic decision exactly, cite only real risk flags, and invent no amounts, rates or regulations. A memo that breaks any rule is rejected and shown as unavailable, never patched with fallback text (`backend/app/agents/report_agent.py`).
- **Vision is evidence, not fact.** Image observations can only fill their own fields; they can never overwrite what the underwriter entered.

## Architecture

```
React + TypeScript (frontend/)
  └── FastAPI (backend/app/api/main.py)
        POST /underwrite/preview   live deterministic score, nothing stored
        POST /underwrite/submit    LangGraph pipeline:
          intake → Gemini Vision → RAG (Gemini embeddings + Qdrant) → deterministic score
          → reference properties (score < 85) → decision → validated Gemini memo → SQLite
        GET  /underwrite/history[/{id}[/report.pdf]]
```

**RAG:** the underwriting-guidelines PDF is split into chunks, embedded with `gemini-embedding-001`, and stored in a Qdrant Cloud collection on first use. Each submission embeds a query built from the property's construction, occupancy, roof age, CAT zone and claims, and retrieves the closest guideline chunks as grounding for the memo. Without Qdrant settings, the same embeddings live in a local JSON index.

## Demo portfolio

Five real Indian properties, one per decision band. Names, locations and images are public; roof age, claims, values and protections are demo assumptions.

| Property | Decision |
|---|---|
| TIDEL Park, Chennai | Accept |
| BKC office, Mumbai | Accept |
| LuLu Mall, Kochi | Refer |
| Crawford Market, Mumbai | Decline (mitigation possible) |
| Cotton Green mill, Mumbai | Auto-Decline |

## Run locally

```bash
# backend
cd backend
pip install -r requirements.txt
cp .env.example .env              # set GEMINI_API_KEY; optionally QDRANT_URL and QDRANT_API_KEY
uvicorn app.api.main:app --port 8000 --reload
pytest -q                          # 34 tests

# frontend (second terminal)
cd frontend
npm ci
npm run dev                        # http://localhost:3000
```

## Deploy (Vercel)

One Vercel project serves both halves: `frontend/` builds to static files and `api/index.py` runs the FastAPI backend as a Python function under `/api`. Set these environment variables in the Vercel project:

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY` | Vision, embeddings and the AI memo. Without it, scoring and decisions still work and AI sections show as unavailable. |
| `QDRANT_URL`, `QDRANT_API_KEY` | Qdrant Cloud cluster for RAG. |

Serverless storage is temporary: new submissions live until the function instance recycles, and the demo portfolio is restored on each cold start.

## Limitations

- Scoring weights are prototype calibrations, not filed insurance rating rules.
- The 300 reference properties are synthetic, not market comparables.
- RAG is grounded in one generic guidelines document, not insurer-specific manuals.
- Uses the `gemini-3-flash-preview` model, which is a preview release.
