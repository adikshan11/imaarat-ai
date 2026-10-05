# Changelog

All notable changes to Imaarat. Versions follow [Semantic Versioning](https://semver.org/) and the format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [2.9.0] - 2026-10-05

### Added
- A "How it works" page that explains the four steps in plain language, what the demo does not claim, and the sources behind it.
- A phone tab bar with a sliding indicator, swipe and drag between tabs, and arrow-key navigation that also works right to left.
- An accessible dropdown that uses the phone's own picker on touch screens.
- CI now runs lint, 17 unit tests and five browser checks (navigation, labels in all 26 languages, touch, desktop and an unfinished draft) on every pull request, with every action pinned to an exact commit.

### Changed
- An assessment draft is kept when you switch tabs, and finished results reopen from the New assessment tab.

### Removed
- Unused preview calculations in the proposal form.

## [2.8.0] - 2026-10-05

### Changed
- Evaluation reports state exactly what they measure and what they do not: each section carries its own status, the dataset is labelled handcrafted synthetic, and a missing report shows "not run" instead of an error.
- Live AI evaluation runs only when started deliberately, with at most four memo generations and no fallback model, so a result always comes from the stated model.
- All actions in the evaluation workflow are pinned to exact commits.

## [2.7.0] - 2026-10-04

### Changed
- Developer mode is no longer shown to visitors; it turns on with `?dev` in the address (or the AI quality and MCP pages) and off from its own button.
- Appearance is a single sun and moon toggle that starts from the device setting.
- The rolling name now shows imaarat.ai in English, Hindi, Bengali, Tamil, Kannada, Punjabi and Urdu.

### Fixed
- Amounts and years read from a paper form that contain letters (such as 2O19) are flagged as not a number instead of having the letters dropped, which could have turned 2,5O,00,000 into a much smaller amount.
- The review screen shows the specific problem instead of "unreadable" when a value fails a check, and the photo crops are larger.

## [2.6.1] - 2026-10-04

### Fixed
- The A2A agent card advertises the imaarat-ai address when PUBLIC_BASE_URL is set, instead of the project's oldest domain.

## [2.6.0] - 2026-10-04

### Changed
- Renamed the product to imaarat.ai, now served at imaarat-ai.vercel.app (the old address still works).
- Layout fixes for every screen size: the sidebar stays full height while scrolling, headline figures sit in an even 4 or 2 column grid, content is centred on wide screens, buttons no longer wrap, and the assessments table shows two flags plus a count instead of overflowing.

### Added
- A "Made with love by Adithya Shankaran" signature.

## [2.5.0] - 2026-10-04

### Added
- Paper proposal intake for people who find web forms hard: a two-page printable form in the chosen language with English underneath, where page 1 (personal details) stays on paper and only page 2 (property and risk) is photographed and uploaded.
- AI reading of page 2 that returns each value with a confidence and the image area it came from; blanks stay blank, values are checked outside the model (PIN code exists, years and amounts in range), and the PIN code, year built and amounts must be confirmed by a person before the values fill a new assessment.

## [2.4.0] - 2026-10-04

### Added
- A logo mark built on इ, the first letter of इमारत, and a wordmark that cycles through Imaarat, इमारत and ইমারত (still when reduced motion is on).
- Icon buttons for language, appearance and developer mode, with the current language shown in its own script and a language picker dialog.
- A phone layout with a top bar and a bottom tab bar, and numeric keypads for PIN codes and amounts.

### Changed
- Calmer dark theme with near-solid surfaces and lighter blur; the desktop sidebar now always spans the full height.

## [2.3.0] - 2026-10-04

### Added
- Location hazard check for every Indian PIN code: seismic zone from the IS 1893:2016 map, the share of the area flooded in 1998-2022 satellite records and the IMD cyclone grade of its district, built from open government data with a tested pipeline.
- When a proposal states a lower seismic zone than the official one for its PIN code, the score uses the official zone and the assessment is flagged.
- Hazard evidence in the form, the result page, a portfolio check of declared against official hazards, an API endpoint and an MCP tool.

## [2.2.0] - 2026-10-04

### Added
- The whole interface in 26 languages: English, the 22 languages of the Eighth Schedule, Bhojpuri, Chhattisgarhi and Tulu, with each script's Noto font and right-to-left layout for Urdu, Sindhi and Kashmiri.
- A notice that translations are machine-made and not yet reviewed, with Santali, Kashmiri, Manipuri, Bodo and Tulu marked as drafts.
- A CI check that every translation has the same keys and placeholders as English.



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
