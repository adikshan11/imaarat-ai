# Governance, security and data sources

What imaarat.ai does about AI risk, personal data and hazard data, mapped to the frameworks an insurer's risk or compliance team will ask about. It describes a demo, not a certified system: nothing here is an ISO certificate, a NIST attestation or legal advice.

## OWASP Top 10 for LLM applications (2025)

| Risk | What the app does | Evidence | Gap |
|---|---|---|---|
| LLM01 Prompt injection | Proposal text reaches the model only as data inside the evidence block. The rules decide before the model runs, and a memo that changes the decision, cites guidance it was not given, names a risk factor that is not a rule flag, or invents amounts or regulations is discarded. | `backend/tests/test_prompt_injection.py` | Attacks are tested against the guardrail, not yet against the live model |
| LLM02 Sensitive information disclosure | Proposer names, business names, mobile numbers and emails are hidden from every public read, left out of the AI prompt and masked out of every trace. Traces are private. | `test_contact_details_reach_only_reviewers`, `test_traces_never_carry_contact_details` | Traces made public before 2.51.0 must be deleted in Langfuse |
| LLM05 Improper output handling | The model must answer in a strict JSON schema, and the result is checked mechanically before anyone sees it. | `app/agents/report_agent.py` | None known |
| LLM06 Excessive agency | The model has no tools and cannot write anything. The rule engine scores and a signed-in reviewer signs off referrals. | `app/agents/graph.py` | None known |
| LLM08 Vector and embedding weaknesses | The guideline corpus is a single reviewed file, versioned by hash; visitors cannot add documents. | `app/tools/rag_lookup.py` | None known |
| LLM09 Misinformation | Hazard facts come from official data by PIN code, not from the model; the memo may cite only the sections it was given. | `/api/hazard/sources` | Faithfulness is measured on two synthetic cases |
| LLM10 Unbounded consumption | Daily and per-minute AI limits, a per-visitor allowance, a 60 second request deadline and a daily cap of 300 MCP calls per visitor. | `app/budget.py`, `app/interop.py` | None known |

LLM03 (supply chain), LLM04 (poisoning) and LLM07 (system prompt leakage) are low here: dependencies are pinned and scanned in CI, the model is not trained or fine-tuned, and the system prompt holds no secrets.

## NIST AI Risk Management Framework

| Function | In this project |
|---|---|
| Govern | One owner; rules in `AGENTS.md`; every change goes through CI and a release pull request |
| Map | The AI's job is limited to reading forms, reviewing photos and explaining a decision; it never decides |
| Measure | Weekly evals: rule agreement, guideline retrieval, memo faithfulness; vision benchmark for paper forms; load and stress tests |
| Manage | Daily AI budget, fallbacks to rules-only, human sign-off for referrals, status page with live error rates |

## ISO/IEC 42001:2023

The project follows the standard's management-system ideas (a defined scope, risk assessment, controls, monitoring, improvement through releases) without claiming conformity. A real certification needs an organisation, an audit and records this demo does not have.

## India's Digital Personal Data Protection Act, 2023

| Obligation | What the app does |
|---|---|
| Notice and purpose | The privacy policy states what is collected and why; the paper form asks only about the property |
| Data minimisation | Contact details are optional, never sent to the AI and never shown publicly |
| Security safeguards | Hashed sessions, CSRF tokens, reviewer-only access to contact details, masked traces, secret scanning |
| Erasure and breach handling | Not automated yet: deletion is manual and there is no breach runbook. Both are needed before real proposals are accepted |

## Partner access (A2A and MCP)

- A2A calls need an `X-API-Key`. An operator issues and revokes keys on the account page; the key is shown once and only its SHA-256 hash is stored. Keys in `A2A_PARTNER_KEYS` (`name:hash`, comma separated) still work. Each partner sees only its own tasks, and the agent card advertises the scheme.
- MCP stays open for AI assistants because its tools are read-only, store nothing and return no contact details; each visitor gets 300 calls a day.

## Hazard data source register

Checked on 12 October 2026 against the issuing body's own pages.

| Peril | Source used | Spatial unit | Status |
|---|---|---|---|
| Earthquake | IS 1893 (Part 1):2016 seismic zones II to V, and Annex E town zones | Zone polygons, towns | Current. A revised map with a Zone VI (PIB, 17 Dec 2025) was withdrawn in March 2026 (PIB, 1 Apr 2026) |
| Cyclone | IMD RSMC New Delhi, Cyclone Hazard Climatology, June 2023: 100 districts in four classes | District | Current; PDF only, districts predate later splits |
| Flood | NRSC/NDEM satellite-observed inundation 1998 to 2022; Chennai and Bengaluru corporation flood points | PIN area share, points | No official all-India flood zonation exists; NDMA has atlases for five states only |
| Landslide | Not used | | NRSC Landslide Atlas of India (2023) ranks 147 districts by exposure; candidate for the next release |
| Lightning, hail, tsunami, storm surge, forest fire | Not used | | No official downloadable hazard layer found, so the app shows no value |
| Heat wave | Not used | | Not an insured property peril in IRDAI wordings |

Peril names follow IRDAI policy wordings (storm, tempest, flood and inundation; earthquake; landslide and rockslide; bush and forest fire). Distances are asked in kilometres; a site under 1.6 km from the coast or a forest is flagged.

## Sources

- OWASP Top 10 for LLM applications: https://genai.owasp.org/llm-top-10/
- NIST AI RMF: https://www.nist.gov/itl/ai-risk-management-framework
- ISO/IEC 42001:2023: https://www.iso.org/standard/42001
- PIB, revised seismic zonation (17 Dec 2025): https://pib.gov.in/PressReleasePage.aspx?PRID=2205330
- PIB, IS 1893:2016 remains current (1 Apr 2026): https://www.pib.gov.in/PressReleseDetailm.aspx?PRID=2247533
- IMD Cyclone Hazard Climatology: https://rsmcnewdelhi.imd.gov.in/uploads/climatology/hazard.pdf
- NDMA flood hazard atlases: https://ndma.gov.in/flood-hazard-atlases
- NRSC Landslide Atlas of India: https://www.nrsc.gov.in/nrscnew/resources_atlas_landslide.php
- IRDAI Bharat Sookshma Udyam Suraksha wording: https://irdai.gov.in/documents/37343/0/Annexure-II-+Bharat+Sookshma+Udyam+Suraksha.pdf/5916c277-d7b6-4ca4-6ba7-81e0cf4ac37a?t=1633438385752
