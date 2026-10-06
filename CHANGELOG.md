# Changelog

All notable changes to Imaarat. Versions follow [Semantic Versioning](https://semver.org/) and the format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [2.22.2] - 2026-10-06

### Fixed
- Ticked options on the paper form are no longer thrown away. The form printed options as "Frame (timber)", "Wind / cyclone" or in the chosen language, while the reader accepted only the bare English names, so even a correct reading of construction type, main hazard or a yes/no box could be rejected. The form now prints the English option name next to each local option, the reader is told to answer with those names, and the checks accept the printed wording by matching the longest option name. Found by the form-reading benchmark, where choice fields scored 32 to 37 percent.

## [2.22.1] - 2026-10-06

### Changed
- The AI write-up is now called the "AI risk summary" in every language instead of a "memo", matching how insurance AI tools name a decision-ready summary and the words Indian proposers and underwriters use; the status page step is renamed to match.

## [2.22.0] - 2026-10-06

### Added
- A form-reading benchmark that renders the app's own printed form in seven languages with handwriting fonts and photo-like blur, then compares the app's Gemini reader, Sarvam Extract and Qwen3-VL field by field with the app's own checks, reporting accuracy, wrong-but-filled values, latency and tokens. It runs on demand in GitHub Actions so the API keys stay in GitHub.
- Printed form fields carry a field name, so tests can fill and read them reliably.

## [2.21.1] - 2026-10-06

### Fixed
- Switching language is now a single, clean change: the new translations and the script font are fetched first and applied in the same frame, instead of the text redrawing in a fallback font and then reflowing (Telugu, Tamil, Hindi and Malayalam went from 3 or 4 visible states to 2). A slow network shows the new language after at most 1.5 seconds.
- Sidebar menu items keep the same 48-pixel height in every language; long labels wrap to at most two lines inside it instead of making that item taller.

## [2.21.0] - 2026-10-06

### Changed
- Paper-form reading and property-photo review now ask Gemini for low thinking, which Google recommends for extraction tasks and which cuts latency and billed output; the AI memo keeps the model's default thinking until an evaluation shows low thinking keeps its quality.
- The AI usage ledger now counts thinking tokens as output, because Google bills them as output, so token and cost figures are no longer understated.

## [2.20.0] - 2026-10-06

### Added
- The status page shows the last load tests, Lighthouse audits and evaluations from the main branch, each linked to its GitHub Actions run. The workflows publish a one-row summary of every main-branch run to the app database; pull-request runs are not published.

## [2.19.1] - 2026-10-06

### Fixed
- Guideline search no longer re-embeds the 12 guideline sections on every server start. The vectors are embedded once per guideline version, stored in the app database and cached in memory, so a fresh server reads them instead of spending about 2 seconds and 2 Gemini calls; editing the guidelines triggers one new embedding automatically.

## [2.19.0] - 2026-10-06

### Added
- Loaders: while an assessment runs or a paper form is read, a progress panel shows an animated pixel grid, the elapsed seconds, how long it usually takes and what happens in the meantime; pages, the dashboard and the status page show shimmering placeholders while they load. Animation stops for people who prefer reduced motion, and screen readers are not interrupted every second.

## [2.18.1] - 2026-10-06

### Fixed
- An assessment can no longer time out at Vercel's 60-second limit when Gemini is slow or busy. Each Gemini attempt now stops after 25 seconds, and all AI steps of one assessment share a 50-second budget: a retry starts only if its wait and a full attempt still fit, otherwise the memo is reported as busy and the rules decide. Before, one attempt could run for 60 seconds and retries came on top.

## [2.18.0] - 2026-10-06

### Added
- A public Status & quality page: version and AI state, request volume with 4xx and 5xx errors over time, latency percentiles per route, Gemini calls, failures, latency and tokens per stage, AI memo availability, and a step-by-step timing waterfall for recent assessments. It shows aggregated numbers only, refreshes every 30 seconds while open, covers the last 24 hours or 7 days, and is reachable from the sidebar and from a footer link on every screen size.

## [2.17.0] - 2026-10-06

### Added
- Operational telemetry in the app database: every API request (route template, status, latency, cold start, error type), every assessment as a trace, and every workflow step and Gemini call as a timed span. No inputs, PIN codes, addresses or error messages are stored, rows older than 14 days are pruned, and a telemetry failure never fails a request. Records are queued in memory and written in batches every 2 seconds, so the request path never waits on the database; the last 2 seconds can be lost if a server instance shuts down.
- An aggregated summary endpoint for the coming status page: traffic and errors over time, latency percentiles per route, AI calls, tokens and latency per stage, memo outcomes, and the step-by-step timing of recent assessments.

## [2.16.0] - 2026-10-06

### Changed
- The portfolio dashboard gets its totals from a new server summary and loads the submissions table one page at a time, with search, decision filter and sorting done on the server. Before, every visit downloaded and decoded every assessment ever made, which the 200-user load test showed as the slowest request.

## [2.15.3] - 2026-10-06

### Fixed
- When Google's AI model is busy, the result now says so in plain words and that the decision came from the rules, instead of showing Google's raw error.
- Live evaluations set up the reference-property database before measuring, so the token and memo sections run on a fresh machine.

## [2.15.2] - 2026-10-06

### Changed
- The API now runs in Singapore, next to its Postgres database and closer to Indian users, instead of Vercel's default Washington, D.C. region.

## [2.15.1] - 2026-10-06

### Fixed
- Several assessments arriving together on a fresh server no longer fail: the assessment workflow and its Postgres checkpoint tables are now set up once, even when requests race to be first. The 200-user load test found this.

## [2.15.0] - 2026-10-06

### Added
- A load test that runs the API against Postgres with simulated underwriters looking up PIN-code hazards, previewing, submitting and browsing history, and reports throughput and response times per endpoint. It runs on demand and on changes to the test itself.

### Fixed
- The backend development requirements install again: the web server pin was older than the MCP library allows.
- Assessments and form reading no longer stall the server: the rule engine, AI calls and database writes run off the request loop, so one slow assessment does not delay every other visitor.

## [2.14.1] - 2026-10-06

### Changed
- The nightly data pipeline workflow now pins every GitHub action to a release commit, like the other workflows, so a moved tag cannot change what runs.

## [2.14.0] - 2026-10-06

### Changed
- The paper proposal is now one A4 page with only property and risk details (form IMR-PF-2). The old first page asked for names, contact details and a signature that the app never read, so it is gone; nothing personal goes on paper or into the uploaded photo.
- Printing the form no longer adds a third page with the site footer.

## [2.13.1] - 2026-10-06

### Changed
- The Inter font is served from imaarat.ai itself and preloaded, instead of from Google Fonts, so the first text paints without a late font swap on slow phones.

## [2.13.0] - 2026-10-06

### Added
- City-recorded flood points for Chennai (Greater Chennai Corporation inundation and 2015 flood points) and Bengaluru (BBMP flood-vulnerable, flood-prone and low-lying locations): 1,343 points across 199 PIN codes. This covers urban waterlogging that satellite flood maps miss; PIN codes outside these cities show no data rather than zero.
- A PIN code with any city-recorded flood point is flagged for flood history.

## [2.12.0] - 2026-10-05

### Added
- A daily AI budget: every assessment, form reading, A2A request and MCP search takes a slot from global and per-visitor caps, and every Gemini attempt, retries included, is reserved before it is made. Reservations are atomic, so parallel servers cannot overspend, and the day resets when Google's quotas reset.
- An AI usage ledger and the remaining budget on the status endpoint.

### Changed
- Each AI call uses one configured model and retries only rate-limit and server errors, at most three times; the fallback to a lighter model is gone.
- On the hosted demo, AI runs only when the budget lives in a shared Postgres database; otherwise AI stages are skipped and the result says why.
- Every backend test now uses its own temporary database.

## [2.11.0] - 2026-10-05

### Changed
- Faster, steadier first load, measured with Lighthouse: the demo notice no longer pushes the page down after loading (desktop layout shift was 0.71), web fonts load without blocking the first paint, the unused Playfair Display font is gone, and secondary pages load only when opened.
- Hashed assets are cached for a year, since their names change whenever their content does.
- Accessibility and search: correct heading order, a labelled action column, readable footer contrast, no prohibited ARIA attribute, and a page description.

### Added
- A Lighthouse workflow that audits the live site on mobile and desktop every week and on demand.

## [2.10.1] - 2026-10-05

### Changed
- Hindi uses IRDAI's own wording where its Hindi pages give a term: बीमांकन for underwriting and संकट for peril (other terms such as बीमित राशि, प्रस्तावक and दावा already matched).

## [2.10.0] - 2026-10-05

### Changed
- Seismic zones near the 104 towns of the IS 1893 (Part 1):2016 town list now come from the code itself instead of the coarse zone map, which corrects 63 PIN codes, including Shimla (Zone IV, not V). The map zone and the source are kept for every PIN code, and the hazard card says which one was used.
- The hazard seed is always rebuilt, so a new column cannot break an existing warehouse.

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
