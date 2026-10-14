# Changelog

All notable changes to Imaarat. Versions follow [Semantic Versioning](https://semver.org/) and the format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [2.65.1] - 2026-10-14

### Fixed
- On phones the footer credit stacks cleanly and no longer leaves a stray dot at the start of the icon row.

## [2.65.0] - 2026-10-14

### Changed
- Saathi is a floating button at the bottom right of the window again, like a standard chat assistant: always in view while you scroll, and her chat opens above it. The footer text keeps clear of her.

## [2.64.2] - 2026-10-14

### Fixed
- In the collapsed sidebar the buttons now sit close to the bottom: the hidden tagline no longer keeps its space under them.

## [2.64.1] - 2026-10-14

### Changed
- Saathi is no longer fixed to the window. She sits at the bottom right end of the page, just above the footer, and scrolls with the page, so she never covers a card. Her chat still opens at the bottom right and closes with the down arrow.
- The sidebar buttons sit closer to the bottom edge.

## [2.64.0] - 2026-10-14

### Added
- After each answer Saathi offers up to three new follow-up questions that build on it, instead of the same fixed suggestions.
- A down arrow in the Saathi header minimises the chat; the conversation is kept.

### Changed
- Saathi now sits at the bottom left, just above the sidebar controls, so it no longer covers cards. Her chat opens at the bottom left, and the greeting appears beside her.
- The Saathi chat and button have solid backgrounds instead of showing the page through them.
- The footer is back at the end of the page, not following the scroll, and sits at the window bottom on short pages with a smaller gap below it.
- The PDF report is easier to read: a decision banner with its meaning and score, plain names for risk flags and score factors, a total on the score table, and every table wraps its text instead of running off the page.

### Fixed
- The microphone in Saathi works: the site's security headers had blocked the microphone for the whole site.

## [2.63.0] - 2026-10-14

### Added
- Every printed paper form now carries its own serial number and QR code. The Print button asks the server for a fresh serial, valid for 7 days. Reading a photo of the form needs a valid serial, and each serial works once.
- The photo is checked against the serial before any AI call when the browser can scan the QR code; otherwise the AI reads the printed serial and the server checks it before returning any values.
- A public status check at `/paper/printouts/{serial}` reports valid, used, expired or unknown, and each visitor can print up to 20 forms a day.

### Changed
- The fixed footer has a solid background so cards no longer show through it.

## [2.62.0] - 2026-10-14

### Changed
- The sidebar collapse is smoother: the labels fade while the bar glides, with no text jumping. The collapse button is now a small arrow at the top right edge of the bar instead of a labelled row at the bottom.
- The footer is fixed to the bottom of the window in two lines, links above and "© 2026 imaarat.ai · Made with ♥ by Adithya Shankaran · icons" below. Saathi and her chat sit above it.
- Saathi's code now starts downloading as soon as the app opens, so she appears sooner.
- Scrollbars are slim and match the green theme, with no arrow buttons.
- CI job names drop the "Test" prefix: Backend, Frontend, Pipeline and Container.
- The printed form has a faint repeating "imaarat.ai IMR-PF-3" watermark behind the fields, and its footer line is part of the page flow so it can no longer overlap the note above it.

## [2.61.1] - 2026-10-14

### Fixed
- The note at the bottom of the printed paper form no longer runs into the footer line.

## [2.61.0] - 2026-10-14

### Added
- Seismic Zone VI (IS 1893:2025) can now be declared on the form, the paper proposal and the API. It scores like Zone IV and V. The official PIN lookup still uses the 2016 map.

### Changed
- The printable proposal is now form IMR-PF-3: sections for property, building, hazards, protection and sums insured, aligned tick grids, the Imaarat mark in the header and a footer line.
- The printed page has no margin of its own, so the browser no longer adds its date, title and web address to it. The corner marks sit inside the page.
- The footer Connect list starts with Email, and the GitHub and Portfolio links are removed. An Instagram icon sits beside GitHub and X in both footers.

### Fixed
- The Saathi button and chat panel no longer print on the paper form.

## [2.60.0] - 2026-10-14

### Added
- A double-arrow button collapses the desktop sidebar to icons only and expands it again; the choice is remembered and the page content widens to fill the space.
- A Developers page, linked from the footer, holds the MCP and A2A endpoints, tools and the example request that used to sit under the status page.
- The status page opens with an overall line and a health card for each part: API, database, cache, AI model, guideline search and tracing.
- Redis in the technology list.

### Changed
- Status is no longer in the sidebar; it stays in the footer. The footer is now three tidy parts: copyright, links and credit.

## [2.59.0] - 2026-10-14

### Added
- A shared store for caches and counters. With `REDIS_URL` set, every instance shares the chat reply cache, the pause after repeated model failures, cached query embeddings and chat allowances; without it they stay in memory, and an unreachable Redis falls back to memory and Postgres. The Docker stack now runs Redis and CI checks that it is really used.
- A model and thinking level for each stage: `AI_MODEL_<STAGE>` and `AI_THINKING_<STAGE>`. The dev console shows the model each stage uses.
- Query embeddings are cached, so a repeated search costs no embedding call.

### Changed
- Saathi's prompt has a fixed first part that no longer changes with the language, and sends fewer, shorter passages, a shorter history and a 60-word answer limit, which keeps each call small and cache-friendly.

## [2.58.2] - 2026-10-13

### Added
- `AI_CHAT_MODEL` lets Saathi chat use its own model, for example a lighter one with a separate quota, while assessments keep using `AI_MODEL`. Failed chats also say when the cause is a daily quota.

## [2.58.1] - 2026-10-13

### Fixed
- Saathi says why it could not answer (the kind of failure, never the question) and has more room for its replies, so longer answers in Indian scripts are not cut off.

## [2.58.0] - 2026-10-13

### Added
- Saathi, a small assistant that pops up at the bottom right. It answers from the underwriting guidelines in the chosen language, by typing or by voice (where the browser supports it), can read replies aloud, and can open a page or switch the app language when asked. Chat has its own small daily allowance, separate from assessments, and never makes a decision.
- Saathi guardrails: prompt-injection attempts are refused before any model call, messages, history and replies are cleaned and length-limited (no links, markup or code), repeat questions come from a cache, the model gets a short timeout, a capped reply size and low thinking, repeated model failures pause chat for 30 seconds, and chat always leaves part of the daily AI calls for assessments.

### Changed
- The mobile tab bar lens now only bends light. The colour split and the extra colour boost at the lens rim are gone, so there is no rainbow; the glass shows only refraction and white highlights, and the bar has no lens filter at rest.
- The privacy policy covers chat, voice and the map.

## [2.57.0] - 2026-10-13

### Added
- Sign up and log in with Google, an email address or a mobile number. Email and mobile accounts use a password, stored only as a salted scrypt hash. The address or number is not verified.
- GitHub and X links in the app and landing footers.
- The sources list on the Guide page now has 16 sources, all from the reference library, instead of 3.
- After you submit an assessment, the result screen first shows the checks running one by one, then reveals a risk gauge, the factors that drove the score and the hazard exposure as bars.
- A Google Map on the property form: search an address in India, click the map or drag the pin, or use your live location. The latitude, longitude, address, city, state and pin code fill in. The result screen shows the pinned property. The map appears only when `GOOGLE_MAPS_API_KEY` is set.

### Changed
- GitHub sign-in is removed. After signing up you go straight into the app and the account menu holds Sign out; the profile and partner-key settings are for the owner only.
- The mobile tab bar now follows a refracting glass bar. At rest it is a translucent bar with a slightly darker selected cell. While you press or slide, only the cell changes: it grows out of the bar as a clear lens that magnifies the icons and refracts what is behind it, with colour fringing only at the lens rim. The bar itself stays put, and its tint opens up under the lens. Chrome draws the refraction of the page behind the lens; other browsers still get the magnified icons with the rim refraction.
- The privacy policy describes email, mobile and Google accounts.

## [2.56.0] - 2026-10-13

### Added
- A dev console for the owner: deployment and AI settings, the LangGraph workflow, a retrieval lab that ranks guideline sections by vector, keyword and fused score, recent AI calls, assessment traces and the API surface. It shows no visitor inputs or secrets, and only an operator can open it.
- "Owner sign-in" on the sign-in page. It asks Google for the email address once, lets in only the addresses in `OWNER_EMAILS`, and stores no email.

### Changed
- The mobile tab bar is wider, more transparent and has a rainbow glass edge. The pressed tab becomes a lens with a rainbow ring and a magnified icon, and Chrome adds colour fringing to the distortion.
- A check of all 25 translated files found every key present, in the right script and not left in English. The status page and the legal links stay English on purpose.

## [2.55.1] - 2026-10-13

### Changed
- The fallback-model code is removed, not only switched off. `AI_FALLBACK_MODEL` and its limits no longer exist; every call goes to `AI_MODEL`.
- The IRDAI master circular note (R3) now cites IRDAI's own English PDF, read by OCR, instead of a trade-site copy. Its claims were re-checked against that text.
- The "Built with" logos are grey and turn to their own colours on hover. DeepEval shows its official wordmark and Sarvam AI its official symbol.

## [2.55.0] - 2026-10-13

### Changed
- The AI risk summary now thinks at the LOW level, like form reading and photo review do, so it finishes inside the time limit instead of timing out.
- No second AI model is used any more. Every call goes to the configured model only, as ARCHITECTURE.md already said. Before, a busy or slow main model was replaced by `gemini-3.5-flash-lite`; that model is now only the default evaluation judge.
- The "Built with" strip is one black-and-white row of the main frameworks and services, moving right to left, with no background or descriptions.

### Added
- The source-text job reads scanned PDF pages with OCR, so documents that carry no text layer can be read and cited.

## [2.54.1] - 2026-10-13

### Changed
- The eval writes AI summaries through the same main-then-fallback model path as the app and records which model answered. Before, it switched the fallback off, so every summary failed whenever the main model was slow, while the app itself fell back and succeeded.

## [2.54.0] - 2026-10-13

### Added
- The "Built with" strip shows the whole stack in two endless rows, each tool with its role: Gemini, LangGraph, Qdrant, MCP, A2A, Langfuse, DeepEval, Hugging Face, Sarvam AI, Python, FastAPI, Pydantic, SQLAlchemy, PostgreSQL (Neon), React, TypeScript, Vite, Tailwind CSS, dbt, DuckDB, Docker, GitHub Actions, Playwright, Lighthouse and Vercel. It pauses on hover and stops moving for people who prefer reduced motion.
- Five reference notes read from the official documents: the insured events and exclusions in IRDAI's Sookshma policy, IS 1893 seismic zone factors, IS 875 wind speeds and the coastal cyclone factor, the National Building Code fire-fighting table, and the MoES climate assessment.
- A CI job that downloads public PDFs and extracts their text, so sources are read from the publisher's own file.

### Changed
- The IRDAI notes now cite IRDAI's own guideline PDF instead of a trade-site copy.
- In the eval only, a search that gets no answer is retried once, and a summary that fails because the model is busy or timed out is retried once after 30 seconds with a 60-second timeout.

## [2.53.0] - 2026-10-13

### Added
- Landslide check: every PIN code in the 147 districts that NRSC's Landslide Atlas of India (2023) ranks by landslide exposure now shows its district rank and is flagged. The flag is not scored. Districts formed later take their parent's rank.
- A reference library of 41 short notes from public Indian sources (IRDAI, NDMA, IMD, CWC, INCOIS, BMTPC, BIS, NRSC, open-access papers and press reports), each with source, date, link and authority. The workflow adds the two closest notes next to the guidelines, the result page shows each note's authority, and news is marked as not authoritative.
- The live eval asks 41 hand-written underwriter questions, one per note, and reports how often the right note comes back.
- A hazard data job in CI rebuilds the PIN code table from the official sources.

### Changed
- The paper form prints the English option names that match the online labels, such as "Cyclone or storm", and the reader maps them back. Before, it printed internal names such as "Wind", and "Hailstorm" could not be read back.
- A risk summary for a property with no risk flags may leave key risk factors empty. Before, such summaries were always rejected.
- Guideline G3 names hail zones as a moderate exposure that is captured but not scored.
- The landing page tour shows the current screens.

## [2.52.0] - 2026-10-13

### Added
- Operators can create, list and revoke A2A partner keys on the account page. A key is shown once and only its hash is stored, so a new partner no longer needs a redeploy.
- The online form asks the proposer to confirm the details are true and complete before it can be submitted.
- A "Built with" strip of the main tools sits at the bottom of the landing page.

### Changed
- Distances to the coast and to a forest are asked in kilometres. A site under 1.6 km (one mile) is flagged, so scores do not change.
- Guideline search runs after the rule engine and searches with the risk flags, then merges vector and keyword (BM25) rankings. Before, it searched with the facts alone and found the right guideline for half of the measured cases.
- The guideline text uses Indian terms: a ₹2 crore value threshold, kilometres, forest fire, and the newer protections.
- The retrieval eval runs the app's own search over all 24 cases instead of 2.

## [2.51.0] - 2026-10-12

### Security
- AI traces no longer carry proposer names, mobile numbers or emails, and traces are no longer made public or linked from the result page. Before, the whole proposal was recorded in a public trace.
- Sending work to the A2A agent needs a partner key in the `X-API-Key` header, and each partner sees only its own tasks. The agent card advertises the scheme.
- MCP stays open to AI assistants, with a cap of 300 calls a day per visitor.

### Added
- Required fields carry a red asterisk on the online form and on the printed paper form, with a note explaining it.
- The paper form asks for the distance to the coast, which the rules score. The six new protections stay online only for now: with them, the Indian-language versions of the form no longer fit on the single page that is photographed.
- Tests that a memo obeying a prompt injection is rejected and that injected text cannot move the score.
- GOVERNANCE.md maps the controls to OWASP's LLM risks, the NIST AI framework, ISO/IEC 42001 and India's DPDP Act, and lists the official source and status of every hazard value.
- ARCHITECTURE.md explains why A2A tasks use both memory and the database, why each library is used, and how guideline search works.
- A git pre-commit hook keeps MAP.md current.

### Changed
- Hazard names follow Indian policy wordings: "Cyclone or storm", "Hailstorm" and "Forest or bush fire".
- A2A tasks are cached in memory for 15 minutes at most, and a task no longer returns its assessment twice.

## [2.50.0] - 2026-10-12

### Security
- Proposer names, business names, mobile numbers and email addresses no longer appear in the dashboard, the assessment pages or the PDF report unless a signed-in reviewer opens them. Before, anyone could read them without signing in.
- Contact details are no longer sent to the AI service when it writes the risk summary; it never needed them.

### Removed
- The GraphQL API at /graphql and the Strawberry library behind it. The dashboard now uses the same REST endpoints as everything else.

### Added
- Six more protections an Indian property can declare, grouped by peril: fire hydrants, fire extinguishers, a valid fire NOC, lightning conductors, earthquake-resistant design and a cyclone-rated roof. They lower the live preview figure; earthquake design counts only in seismic zones IV and V, and the cyclone roof only in a wind zone or within a mile of the coast. The rule engine's score and decision do not change.

### Changed
- "Security / protective safeguards" is now "Burglar alarm, CCTV or guards", which is what it meant.
- The benefit rows in the live preview have a small gap between them.
- The phone tab bar keeps a small even gap around the highlighted tab, the highlight no longer spills outside the bar when pressed, and dragging it shows a clear glass lens instead of a solid pill.
- In the light theme the highlighted tab is a bright white pill and the background glows are softer, so the screen no longer looks dark and muddy on TVs.
- A2A proposals now become real tasks. A referred case stays working until an underwriter signs off and then turns completed, and `tasks/get` finds it from any server, not only the one that took it. A proposal missing construction, occupancy, hazard zone or sprinkler details is rejected with the list of what is missing. Every result says it is indicative, not a quote or a binding decision.
- ARCHITECTURE.md has an agent map showing who uses REST, MCP and A2A and why, and MAP.md lists every source file with its purpose so AI coding agents can find code without opening files.

## [2.49.1] - 2026-10-12

### Changed
- The home page logo drops its square background and comes in two colourings, one for the dark menu bar and one for the light one.
- The menu underlines the section you are reading, and the figures under the opening section sit centred in a panel with a soft edge and shadow, so its left side no longer melts into the background.

## [2.49.0] - 2026-10-12

### Added
- The home page names the public data every proposal is checked against (India Post, BIS IS 1893, NRSC, NDEM, IMD, data.gov.in and the Chennai and Bengaluru city corporations) right under the opening section.
- The opening section lists the supported Indian languages in their own scripts.

### Changed
- The home page follows the order a buyer asks questions in: the problem, how it works, the product, the details, who it is for, then the technical proof.
- Body text on the home page is darker, for easier reading on bright screens.
- The home page spreads across wide screens with even side margins, and the menu bar is taller with a larger logo.
- The strip of software logos is gone, and the integrations card says in plain words that your policy, broker or claims software and AI assistants can use the same assessment.
- The figures say 11 public hazard datasets instead of 11 data sources, and English plus 25 Indian languages instead of 26 Indian languages, matching what the app actually has.

## [2.48.4] - 2026-10-12

### Changed
- The home page uses a wider 1280-pixel column, the same width as GitHub's, so the menu and content sit less tightly in the middle on laptop screens.
- The menu bar now changes between dark and light glass only when a section boundary passes under it, instead of checking on every scroll frame.

## [2.48.3] - 2026-10-12

### Changed
- The home page menu bar is clear glass over every dark green section, not only the photo, so it no longer shows a pale band or a second shade of green, and it is a little more see-through over the light sections.

## [2.48.2] - 2026-10-12

### Changed
- The product screenshots on the home page show the current app: the portfolio, an assessment result, the paper form and the new status charts.

## [2.48.1] - 2026-10-12

### Changed
- The status page charts use softer colours that read well in light mode, with rounded bars, faint guide lines and a highlight on the hour you point at.

## [2.48.0] - 2026-10-12

### Added
- The phone tab bar is clearer liquid glass that bends what scrolls behind its edges in Chrome, Edge and other Chromium browsers, and the selected tab swells out of the bar while you press or slide across it, like iOS.
- Thin fading dividers separate the four figures on the home page.

### Changed
- The phone tab bar no longer has dividers between tabs.
- The home page menu bar turns into dark glass over the photo and light glass further down, instead of a pale band over the photo, and the home page pills, buttons and cards lose their white outlines.

## [2.47.1] - 2026-10-12

### Changed
- The language, appearance and account buttons and the selected menu item no longer have white outlines, and the glass behind the home page figures has no white rim and a thinner, slimmer edge.

## [2.47.0] - 2026-10-12

### Added
- A calm branded loader replaces the grey placeholder blocks while a page loads, carrying on from the first screen without a jump.

### Changed
- On phones and tablets the selected tab is a capsule that fills its whole slot and reaches the rounded ends of the bar, the bar's light outline is replaced by a soft inner highlight, and thin dividers separate the other tabs.
- The glass on the home page loses its bright rim for a soft inner highlight.
- The app starts faster after a quiet spell: the connections for AI assistants (MCP) and other agents (A2A) now load on their first use instead of every time the server starts.

## [2.46.0] - 2026-10-12

### Added
- The figures under the home page headline sit on a pane of liquid glass that bends the photo behind it at its edges, like real glass, with a frosted fallback where WebGL2 is unavailable and a solid panel for reduced transparency, higher contrast and forced colours.

## [2.45.4] - 2026-10-09

### Fixed
- On phones and tablets the highlight behind the selected tab now fills the bar to its top, bottom and outer edge, like the iOS tab bar, instead of floating inside it.

## [2.45.3] - 2026-10-09

### Changed
- Pull requests are tested in CI without a deployment; only preprod and main deploy, which cuts stored deployments to about two per release. CI now reports the size of the server function's dependencies and fails if it grows past a budget. The optional Qdrant client (which brought numpy and gRPC) and the PDF reader used only by the data pipeline are no longer installed in the server function, cutting its dependencies by about a third; the Docker image and evals still install the Qdrant client.

## [2.45.2] - 2026-10-09

### Fixed
- The lighter fallback model now has its own daily and per-minute limits, matching Google's free tier for it (500 a day, 15 a minute), so a summary written by it no longer uses the main model's 20 a day, and a busy main model is skipped for two minutes.
- Each AI attempt is now limited to the time left in the request, and the main model always leaves 15 seconds for the fallback, so a main model that hangs no longer leaves the summary without time.

## [2.45.1] - 2026-10-09

### Fixed
- When the main Gemini model is busy, the AI risk summary now switches to the lighter model straight away instead of retrying first, so the request still has time for it.

## [2.45.0] - 2026-10-09

### Added
- Each assessment links to its Langfuse trace, which now shows every pipeline step, the hazard lookup, paper form reading and embeddings, with real AI call times and failed calls marked as errors.

### Fixed
- The AI risk summary now falls back to a lighter Gemini model when the main model is busy, instead of failing.

## [2.44.0] - 2026-10-08

### Added
- A new Hawa Mahal logo: stepped jharokha pillars around an arched doorway that forms the i.
- Signed-in sessions now end after 15 minutes without activity or 8 hours at most, with a two-minute warning and a Stay signed in button; signing out in one tab signs out every tab.
- One upload policy for every photo: type, size and pixel limits are checked on the server and shared with the app, so property photos are now checked too.

### Changed
- No deprecated React, TypeScript, CSS or Python APIs remain, and CI now fails if one is used, along with new JSON, YAML, workflow and shell checks.

## [2.43.0] - 2026-10-08

### Added
- An account menu with your name and photo, a Profile and settings page, and a clear Sign out.
- After signing in you add your full name and mobile number before using the app; reviewers' names now appear on the referrals they review.
- An optional profile photo, resized to a small square with its camera details removed.

### Changed
- Open the app on the home page now shows the sign-in page unless you are already signed in.

## [2.42.0] - 2026-10-08

### Added
- The status page shows today's Gemini free-tier quota (generations, calls, AI assessments and tokens) and how long until it resets at midnight Pacific time.

## [2.41.2] - 2026-10-08

### Fixed
- The side menu stays in place and fills the window from top to bottom while the page scrolls.
- The six steps on the home page switch again when you pick one.
- Glass panels have a softer, less white edge.

## [2.41.1] - 2026-10-08

### Fixed
- Try the live demo, See a paper proposal, How it works and Status on the home page now open the demo directly instead of the sign-in page.

## [2.41.0] - 2026-10-08

### Changed
- The demo uses the AI again, from the free daily allowance shared by all visitors; signing in is needed only to review referrals.
- The home page shows the tools it is built with in grey, in colour on hover, each linked to its official site, and the product screenshots now fade into each other without flashing.

## [2.40.0] - 2026-10-08

### Changed
- The home page shows the official coloured logos, the app logo returns to the dashboard, the mobile tab highlight follows the bar's rounded shape, slow actions show a loader, and the status page is shorter and shows Gemini token use and the latest AI evaluation.

## [2.38.1] - 2026-10-08

### Changed
- The home page shows the tools it works with as a slowly scrolling row of their logos, which pauses on hover and stays still for visitors who prefer less motion.

## [2.38.0] - 2026-10-08

### Added
- Opening the app now shows a sign-in page: continue with GitHub, or Google once it is configured, or try the demo with the rule engine and sample data.

### Security
- The AI features now need a signed-in user; anonymous visitors, MCP and A2A get the rule-engine decision with a note saying why.

## [2.37.0] - 2026-10-07

### Added
- Two reviewers can no longer decide the same referral: starting a review holds it for 30 minutes and shows others who has it, only the first saved decision counts, and the new-assessment form warns when the same address and PIN code were assessed before. Decisions are signed with the reviewer's GitHub username, and the Privacy Policy and Terms of Service now say so and explain the open-source licence.

## [2.36.0] - 2026-10-07

### Changed
- Each module card on the landing page now shows its part of one real demo assessment (an office at TIDEL Park, Chennai) instead of a link to source code, the licence line is gone from the site footers, and the maker credit links to the portfolio.

## [2.35.1] - 2026-10-07

### Fixed
- A failed paper-form read now says why in plain words (the AI is busy, at its per-minute limit, or out of today's allowance) instead of showing an internal error name. The same wording now comes from the AI gateway for every component and no longer names one vendor.

## [2.35.0] - 2026-10-07

### Changed
- The AI provider is pluggable. Each vendor has an adapter in app/providers behind one small contract (generate, count tokens, embed), and the AI gateway keeps budgets, retries, the request deadline and tracing the same for every provider. Switching provider or model is configuration: AI_PROVIDER, AI_API_KEY, AI_MODEL and AI_EMBEDDING_MODEL, with the old GEMINI names still read.
- An architecture test fails the build if a vendor SDK is imported outside the adapters or an adapter breaks the contract. ARCHITECTURE.md explains the layers and how to add a provider such as Amazon Bedrock.

## [2.34.0] - 2026-10-07

### Added
- imaarat.ai can run anywhere with one command, docker compose up --build, which starts Postgres, the API and the website. CI builds and smoke-tests that exact stack on every pull request.
- Every pull request gets its own Vercel preview, which CI smoke-tests before the change can be merged.
- CI scans the full git history for leaked secrets with gitleaks, and the backend lint now includes the Bandit security rules.

### Changed
- Production deploys wait for the secret scan and the container check as well, and production, preview and container all share one smoke test: the right version, every public page answering, and the security headers present.
## [2.33.2] - 2026-10-07

### Fixed
- GitHub sign-in no longer fails with oauth_invalid. GitHub now names itself in the callback with an iss parameter (RFC 9207); the callback accepts it and rejects any other issuer.

## [2.33.0] - 2026-10-07

### Added
- The product tour moves to the next screen every six seconds, with a pause button. It stops once a visitor picks a screen, waits while the pointer is over it, and never moves for people who ask their device for reduced motion.
- A version badge in the hero links to the changelog, a works-with strip lists the main building blocks, and the footer links to LinkedIn, email and the author's portfolio.

## [2.32.0] - 2026-10-07

### Changed
- The landing page now leads with verified property risk decisions for Indian insurers. A new section shows how declared facts are checked against official hazard data, followed by the six-step workflow, the open-source modules, who it is for and why imaarat.ai.
- The footer has Legal, Product and Connect columns. The legal pages are named Privacy Policy and Terms of Service, and both footers link the MIT License.

## [2.31.1] - 2026-10-07

### Fixed
- Sign-in works on the live site. The base URL setting ends in /api, which made every origin check fail and would have pointed GitHub at the wrong callback address; the site origin is now taken from its scheme and host only.

## [2.31.0] - 2026-10-07

### Added
- Sign in with GitHub. Sessions are random tokens stored only as hashes, end after 30 minutes idle or 12 hours, and every change needs a matching CSRF token and the site's own origin. The GitHub app asks for no permissions; only the numeric account ID is read.

### Security
- Approving or overriding a referral now needs a signed-in reviewer or operator. Before, anyone could do it. Running assessments, reading results and the public APIs stay open as before.
- The privacy policy and terms describe sign-in: the one cookie it sets, the GitHub numeric ID it stores, and how long a session lasts.

## [2.29.0] - 2026-10-07

### Added
- The code is published under the MIT licence.
- A privacy policy and terms of use, written from what the app actually does: what is stored and for how long, what is sent to Google, Vercel, Neon and Langfuse, and that decisions are indicative, not an insurer's offer.
- A changelog page built from this file at every release, linked from the website and app footers.

### Security
- Uploaded property photos are saved under a random name. Before, the name came from the property ID and the uploaded file name, so a crafted name could write outside the upload folder.

## [2.28.0] - 2026-10-07

### Changed
- The hidden developer mode (?dev=1) is gone. Its AI quality evidence and the MCP and A2A integration guide are now sections of the public Status page, and old #quality and #integrations links open Status. Result pages always show the underwriter view: only score factors that added points, the guideline titles, and no model names or trace links.

### Removed
- Thirteen strings used only by developer mode, from all 26 languages.

## [2.27.0] - 2026-10-07

### Security
- Every page now sends a content security policy (scripts, styles, fonts, images and connections only from this site and Google Fonts, no framing), plus nosniff, referrer and permissions policies, and the API refuses to be framed. The landing page redirect moved out of an inline script so the policy can stay strict.

### Fixed
- The dashboard's declared-vs-official hazard counts are now worked out live from each assessment's PIN code, with the same rules the decisions use, so they always match the totals beside them. Before, they came from the nightly analytics snapshot.

### Changed
- The landing page no longer loads React; its screenshot tabs use a few lines of plain JavaScript, so it ships under 1 KB of script instead of 191 KB.

## [2.26.0] - 2026-10-07

### Added
- A landing page at / built with React and Tailwind and rendered to HTML at build time, so it shows without JavaScript and search engines can read it. It covers how the product works, the paper form, the PIN-code hazard check, explain-and-approve, product screenshots in accessible tabs, what is tested, questions and a footer, with link-preview tags, structured data, a sitemap and robots.txt. Photos are AI-generated, served as WebP in several sizes, and the footer says so.

### Changed
- The app moves to /app/. Old links such as /#paper and /?dev=1 redirect there.

### Fixed
- The app no longer says AI is off or that assessments are not kept while its status is still loading; those notes appear only when the status says so.

## [2.25.0] - 2026-10-07

### Added
- The status page shows database size against the 0.5 GB of Neon's free plan, with the largest tables, and how many Gemini generations are left today.

### Security
- GraphQL requests are limited to depth 4, 2 aliases and 1,000 tokens. Before, one request could repeat the history query any number of times under different alias names, multiplying database work.

## [2.24.0] - 2026-10-07

### Changed
- The AI budget now matches Google's free-tier limits for gemini-3.8-flash, read from AI Studio: at most 20 text or image generations a day and 5 a minute, with every retry counted. Embeddings and token counts keep their own larger limits. When the minute limit is reached, the result says to try again in a minute; when the daily limit is reached, it says the free allowance is used. Daily assessments drop to 15 (3 per visitor) and each call is tried at most twice, so assessments leave room for retries and photo or form reading.
- The evaluation scores AI risk summaries in TOON only, the format the app uses, which halves its Gemini calls. The token comparison with JSON stays.
- The form benchmark reads one form per language with Gemini (7 forms, 13 seconds apart) so it fits the free tier.

## [2.23.1] - 2026-10-06

### Fixed
- When the demo has used Google's free daily AI allowance, the result now says so instead of claiming the model is busy, and the app no longer retries a call that cannot succeed until the allowance resets. Retries for short busy spells and per-minute limits are unchanged.

## [2.23.0] - 2026-10-06

### Added
- A read-only GraphQL API at /graphql (Strawberry) with status, PIN-code hazards, portfolio totals, a searchable and sortable page of assessments, and one assessment's full result. Resolvers are asynchronous and run database work off the request loop. Writes such as submitting an assessment or uploading a photo stay on REST.
- The dashboard loads its totals and first page in one GraphQL request instead of two REST calls, and the load test now exercises that query.

## [2.22.2] - 2026-10-06

### Fixed
- Ticked options on the paper form are no longer thrown away. The form printed options as "Frame (timber)", "Wind / cyclone" or in the chosen language, while the reader accepted only the bare English names, so even a correct reading of construction type, main hazard or a yes/no box could be rejected. The form now prints the English option name next to each local option, the reader is told to answer with those names, and the checks accept the printed wording by matching the longest option name. Found by the form-reading benchmark, where choice fields scored 32 to 37 percent.

## [2.22.1] - 2026-10-06

### Changed
- The AI write-up is now called the "AI risk summary" in every language instead of a "memo", matching how insurance AI tools name a decision-ready summary and the words Indian proposers and underwriters use; the status page step is renamed to match.

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

### Fixed
- Assessments and form reading no longer stall the server: the rule engine, AI calls and database writes run off the request loop, so one slow assessment does not delay every other visitor.

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
