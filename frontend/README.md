# Property Risk Assessment — React Frontend

A React 19 + TypeScript + Vite single-page application for AI-assisted commercial property underwriting. The frontend connects to the FastAPI backend at `../backend/`.

---

## Quick start

```bash
npm install
npm run dev        # http://localhost:3000
```

### Prerequisites

- Node 20+
- The FastAPI backend running at `http://127.0.0.1:8000` (see `../backend/README.md`)

---

## Application flow

```
Dashboard  →  New Assessment form  →  Submit  →  Result page  →  Download PDF
                    ↑
          Live risk preview (POST /underwrite/preview on every field change)
```

### Dashboard
- Portfolio KPIs from live API (submission count, average score, CAT exposure, total value at risk)
- Decision distribution
- Top risk drivers
- Recent assessments table with search / filter / sort

### New Assessment form
- Insured / proposer details
- Property & location
- Building & construction (construction type, year built, square footage, stories, roof)
- Natural hazards (CAT zone, seismic zone, distance to coast/fire zone)
- Protection & mitigation (sprinkler, fire alarm, flood protection, generator, drainage, security)
- Requested Coverage & Extensions (RSMD, Flood/STFI, Cyclone/Wind, Earthquake, Terrorism, BI)
- Asset values (building, plant & machinery, FF&E, stock, other contents → derived TIV)
- Loss history
- Property image upload (PNG/JPEG, processed by Gemini Vision)
- **Live risk preview**: debounced POST to `/underwrite/preview` on every field change; shows indicative donut chart, protection mitigation, and authoritative score in real-time without storing a record

### Result page
- Authoritative underwriting decision (Accept / Refer / Decline / Auto-Decline)
- Risk score and flag breakdown
- Configured mitigation factors
- AI-Assisted Underwriting memo:
  - Property Summary
  - Key Risk Factors (deterministic flags only)
  - Coverage Review (requested extensions, not exposure inference)
  - Decision + Rationale
  - Suggested Next Steps
- Vision evidence (image analysis); the uploaded property image is embedded in the PDF report
- Underwriting evidence (RAG guideline excerpts)
- Reference properties (synthetic, not market comparables)
- Download executive PDF

---

## Commands

```bash
npm run dev          # Vite dev server with HMR
npm run build        # Production build → dist/
npm run typecheck    # TypeScript check (no emit)
```

---

## Environment

The API base URL defaults to `http://127.0.0.1:8000`. To change:

```
VITE_API_BASE_URL=http://your-backend-host:8000
```

---

## Key files

| File | Purpose |
|---|---|
| `src/components/assessment/NewAssessment.tsx` | Intake form with live preview |
| `src/components/assessment/BackendAssessmentResult.tsx` | Result + memo rendering |
| `src/components/dashboard/Dashboard.tsx` | Portfolio intelligence dashboard |
| `src/api/underwriting.ts` | API client (preview, submit, history, PDF download) |
| `src/types/backend.ts` | TypeScript types for all API responses |
| `src/context/RiskContext.tsx` | Shared submission state |

---

## Design decisions

- **No TypeScript underwriting engine**: all risk scoring runs on the FastAPI backend. The frontend never calculates a score.
- **Live preview is read-only**: `POST /underwrite/preview` does not write to the database.
- **Coverage ≠ Exposure**: selecting an earthquake extension checkbox does not imply earthquake CAT exposure in the live risk model.
- **Indicative vs authoritative**: the donut chart shows an indicative risk-adjusted view; the authoritative decision comes from the deterministic Python engine only.
- **AI cannot reject independently**: Gemini explains the deterministic Python decision and must return the same decision. Missing/invalid AI output is explicitly unavailable rather than replaced with fallback prose.

---

## Demo portfolio

The checked-in local demo database is intended to show multiple authoritative outcomes:

| Property | Authoritative result | Purpose |
|---|---|---|
| TIDEL Park, Chennai | Accept | Large office, Wind CAT, high TIV |
| BKC office, Mumbai | Accept | Image-backed modern office with a different indicative profile |
| LuLu Mall, Kochi | Refer | Image-backed retail property with Flood CAT, adverse-claims, and high-TIV demo assumptions |
| Crawford Market, Mumbai | Decline (mitigation possible) | Image-backed heritage market with aged-roof, Wind CAT, adverse-claims, and high-TIV demo assumptions |
| Cotton Green mill, Mumbai | Auto-Decline | Image-backed industrial/manufacturing risk with old roof, flood/coastal exposure, no sprinkler, adverse claims, and high TIV |

The historical Cotton Green image is real public-domain source material. Non-public underwriting facts used to exercise the prototype (roof age, claims, values, protection controls) are explicit demo assumptions, not claims about the historical property.

---

## Notes

- `src/data/` and `src/engine/` do not exist — the old TypeScript risk engine was removed. Python is the sole underwriting authority.
- `(optional)` labels are shown only where omission is expected by the underwriter. Core proposer and policy-period fields do not carry the label even though they are schema-optional.
