# Changelog

All notable changes to Imaarat. Versions follow [Semantic Versioning](https://semver.org/) and the format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [2.1.0] - 2026-10-04

### Added
- Dark mode that follows the device, with a light or dark override in the sidebar.
- Glass cards over a soft gradient background, matching the portfolio design.

### Changed
- One token-based stylesheet replaces the old one, with right-to-left support for later languages and a fix for sideways scrolling on phones.

## [2.0.0] - 2026-10-04

### Added
- Underwriter view by default, with a developer mode that shows models, traces, evals and the MCP and A2A pages.
- A notice that says when the demo runs without AI or without persistent storage, and that all data is sample data.
- A status endpoint reporting the version and which capabilities are switched on.

### Changed
- Renamed the product to Imaarat and the repository to uw-risk-assessment.
- Underwriting wording (sum insured, referral, plain decision explanations) and amounts in lakh and crore.
- All interface text now comes from one string file, ready for translation.

## [1.0.0] - 2026-10-03

### Added
- Production-style version of the Xebia capstone: LangGraph flow with Gemini Vision, RAG over the guidelines with citations, validated memos, human review of referrals, evals, Langfuse tracing, MCP server, A2A agent, Postgres and the dbt pipeline.
