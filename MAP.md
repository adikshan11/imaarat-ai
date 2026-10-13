# Repository map

One line per tracked source file: its docstring, exported names or title. Regenerate with `python3 .github/scripts/repo_map.py`; CI fails when stale.

## .

- `.dockerignore`
- `.gitattributes`
- `.gitignore`
- `.gitleaks.toml`
- `.mcp.json`
- `.yamllint.yml`
- `AGENTS.md`: imaarat.ai agent guide
- `ARCHITECTURE.md`: Architecture
- `CHANGELOG.md`: Changelog
- `CLAUDE.md`
- `GOVERNANCE.md`: Governance, security and data sources
- `LICENSE`
- `README.md`
- `compose.yaml`
- `requirements-qdrant.txt`
- `requirements.txt`
- `ruff.toml`
- `vercel.json`

## .claude

- `settings.json`

## .claude/hooks

- `context.py`: Claude Code hook that adds branch context, names matching skills and guards pushes.

## .claude/rules

- `backend.md`: Backend
- `ci.md`: CI and workflows
- `frontend.md`: Frontend
- `workflow.md`: Workflow

## .claude/skills/add-ui-text

- `SKILL.md`: Add UI text

## .claude/skills/live-check

- `SKILL.md`: Live check

## .claude/skills/pr-ready

- `SKILL.md`: PR ready

## .claude/skills/release

- `SKILL.md`: Release

## .githooks

- `pre-commit`

## .github

- `actionlint.yaml`
- `copilot-instructions.md`: Copilot instructions
- `pull_request_template.md`

## .github/scripts

- `check_json.sh`: Every JSON file must parse; hand-edited ones must also match `jq --indent 2` formatting.
- `function_size.sh`
- `lighthouse_summary.mjs`
- `release_check.py`: Release rules: versions match, never fall below main's, and a new version has a CHANGELOG entry.
- `repo_map.py`: Write MAP.md, one line per tracked source file, so agents can find code without opening files; --check fails when it is stale.
- `sarvam_translate.py`: Translate English UI strings with Sarvam into every locale it supports and report them beside the current text.
- `smoke_check.sh`: Checks a running site: /api/status reports this checkout's version, every public page returns 200, security headers are set.

## .github/workflows

- `benchmarks.yml`: Benchmarks
- `ci-cd.yml`: CI/CD
- `nightly_elt.yml`: Nightly ELT

## api

- `index.py`

## backend

- `.env.example`
- `.gitignore`
- `README.md`: Imaarat: commercial property underwriting backend
- `pytest.ini`
- `requirements.txt`

## backend/.github

- `copilot-instructions.md`: Imaarat (imaarat-ai): GitHub Copilot Instructions

## backend/app

- `__init__.py`: Imaarat underwriting package.
- `assistant.py`: Saathi: a guideline-grounded chat assistant that can also open app pages.
- `auth.py`: Sign-in with Google, email or mobile number: hashed opaque sessions, session-bound CSRF tokens and single-use PKCE state, stored in the app database.
- `budget.py`: Daily AI budget: per-visitor and global admissions plus every Gemini call, reserved atomically before use.
- `config.py`: model_for, thinking_for
- `db.py`: Submission and reference-property storage: Postgres when DATABASE_URL is set, SQLite otherwise.
- `dev_console.py`: The owner's dev console: how the running service is built and what it is doing, without any visitor input or secrets.
- `evaluation.py`: report_metadata, empty_report
- `images.py`: One policy for every uploaded image: allowed types, size and pixel limits, decoding and re-encoding.
- `interop.py`: Interoperability: an MCP server (tools for AI clients) and an A2A agent (for other agents).
- `llm.py`: The AI gateway: every model call goes through here for budgets, retries, the request deadline and tracing. Vendor code lives in app/providers/.
- `observability.py`: Langfuse tracing: active only when LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY are set.
- `partners.py`: Partner keys for the A2A endpoint: shown once, stored only as SHA-256 hashes, and revocable without a redeploy.
- `profile.py`: Underwriter profile: name and mobile number are required before reviewing; the photo is optional and re-encoded.
- `reports.py`: build_submission_pdf
- `schemas.py`: redact, PropertySubmission, UnderwritingMemo, VisionObservations, decision_from_score, indicative_product_segment
- `store.py`: Shared key-value store for caches, pauses and daily counters: in memory by default, Redis when REDIS_URL is set.
- `telemetry.py`: Request, trace and span telemetry kept in the app database for the public status page: route templates and timings only, never inputs.

## backend/app/agents

- `__init__.py`: LangGraph underwriting agents.
- `graph.py`: intake_node, extract_features_node, retrieval_query, rag_guidelines_node, score_risk_node, fetch_comparables_node, decide_node, generate_report_node
- `report_agent.py`: build_prompt, generate_memo
- `state.py`: UWState

## backend/app/api

- `__init__.py`: API package.
- `auth_routes.py`: ProfileForm, PartnerForm, SignupForm, LoginForm, oauth_client, oauth_configuration, configured, providers
- `dev_routes.py`: owner_only, overview, architecture, routes, ai_calls, traces, retrieval
- `main.py`: lifespan, Interop, record_requests, health, upload_limits, ChatTurn, ChatRequest, assistant_chat

## backend/app/providers

- `__init__.py`: AI providers. Pick one with AI_PROVIDER; add one by writing an adapter that follows base.Provider and listing it here.
- `base.py`: The contract every AI provider adapter implements. Nothing outside app/providers/ imports a vendor SDK.
- `gemini.py`: Google Gemini adapter (google-genai SDK).

## backend/app/tools

- `__init__.py`: Imaarat tool modules.
- `comparables.py`: comparable_lookup
- `form_reader.py`: FieldReading, digits, choice, check, validate, read_form
- `hazard_lookup.py`: hazard_table, lookup, hazard_flags, verify_location, sources
- `rag_lookup.py`: guideline_sections, corpus_hash, section_document, qdrant_search, cosine, index_items, local_search, words
- `risk_calculator.py`: prototype_mitigation_model, risk_score_calculator
- `vision_extract.py`: extract_property_features

## backend/bench

- `__init__.py`
- `form_cases.py`: Seeded synthetic paper-form cases: what a proposer writes and in which script, for the form-reading benchmark.
- `forms_bench.py`: Form-reading benchmark: the app's Gemini reader, Sarvam Extract and Qwen3-VL on the same rendered forms, scored with the app's own field checks.
- `source_text.py`: Download public PDFs and write their text page by page, reading scanned pages with OCR, so sources can be read and cited from a CI artifact.

## backend/load

- `locustfile.py`: proposal, Reader, Underwriter
- `summary.py`

## backend/ops

- `__init__.py`
- `publish_run.py`: Store one CI run summary (load test, Lighthouse or evaluation) in the app database for the status page.

## backend/tests

- `conftest.py`: photo, isolated_database, isolated_store, empty_telemetry_queue
- `test_architecture.py`: imported_modules, app_files_outside_providers, test_vendor_sdks_are_only_imported_by_provider_adapters, test_the_rest_of_the_app_uses_providers_only_through_the_package, test_every_adapter_follows_the_provider_contract, test_an_unknown_provider_fails_with_the_known_names
- `test_assistant.py`: store, reply, test_chat_returns_page_language_and_sources, test_chat_ignores_unknown_language_and_none_page, test_chat_stops_at_the_visitor_limit, test_chat_is_offline_without_ai, test_chat_endpoint_rejects_bad_input, test_injection_is_refused_without_a_model_call_or_allowance
- `test_auth.py`: client, signed_in, test_review_needs_a_signed_in_reviewer, test_operator_passes_the_check_but_needs_csrf_and_origin, test_partner_keys, test_sign_in_is_off_until_configured, test_providers_list_only_configured_sign_in, test_email_and_mobile_sign_up_and_log_in
- `test_budget.py`: store, test_budget_day_follows_pacific_midnight_like_gemini_quotas, test_visitor_cap_then_global_cap, test_failed_visitor_reservation_does_not_spend_global_budget, test_calls_are_capped_and_recorded, test_ai_is_not_ready_without_key_or_shared_store, test_admission_note_reports_reset_time, ApiError
- `test_database_lifecycle.py`: test_cleanup_is_deterministic_and_retains_canonical_tidell, test_pdf_builder_returns_nonempty_pdf, test_pdf_builder_embeds_submitted_image
- `test_evals.py`: test_empty_cases, test_missing_report, test_null_report, test_no_live_default, test_live_bound, test_unavailable_memo, test_judge_failure, test_failed_live_exit
- `test_form_reader.py`: reading, test_values_are_cleaned_and_checked_outside_the_model, test_blank_and_invalid_values_are_never_filled, test_unknown_pincode_is_flagged, test_money_pincode_and_year_need_confirmation, test_endpoint_is_off_without_a_key, test_endpoint_returns_checked_reading, test_endpoint_rejects_other_file_types
- `test_golden.py`: test_golden_case_matches_deterministic_engine
- `test_graph.py`: use_temp_database, test_referral_pauses_for_review_and_resumes_with_override, test_non_referral_needs_no_review, test_concurrent_first_requests_build_the_checkpointer_once
- `test_hazard.py`: test_golden_locations, test_nrsc_landslide_rank, test_town_list_overrides_the_coarse_map, test_rural_pincode_keeps_the_map_zone, test_flood_share_separates_floodplain_from_dry_city, test_city_flood_points_cover_urban_waterlogging, test_city_flood_points_raise_the_flood_flag, test_unknown_or_malformed_pincode_returns_none
- `test_interop.py`: test_startup_skips_mcp_and_a2a, test_mcp_and_a2a_load_on_first_request, test_a2a_task_follows_the_underwriter_review, test_a2a_needs_a_partner_key
- `test_llm_settings.py`: fake_client, test_every_stage_thinks_low_and_thinking_is_billed, test_a_busy_model_is_retried_on_the_same_model_and_never_switched, test_failures_are_explained_the_same_way_for_every_provider
- `test_portfolio.py`: seed, test_portfolio_totals_match_every_submission, test_history_pages_filters_and_sorts_on_the_server, test_hazard_checks_are_counted_live_from_each_pincode
- `test_prompt_injection.py`: state, memo, test_an_honest_memo_passes, test_a_memo_that_obeys_an_injection_is_rejected, test_injected_text_stays_data_and_cannot_move_the_score
- `test_publish_run.py`: lighthouse, test_ci_runs_are_published_and_shown_newest_first, test_app_and_landing_audits_are_kept_apart
- `test_rag_index.py`: test_guideline_vectors_are_embedded_once_and_reused_after_a_restart, test_hybrid_search, test_reference_notes, test_references_follow_guidelines
- `test_release_check.py`: files, test_a_bumped_documented_release_passes, test_each_rule_reports_its_own_problem, test_unreleased_ci_changes_need_no_version
- `test_report_agent.py`: test_generate_memo_exposes_resource_exhausted_failure, test_daily_quota_is_not_retried_and_says_so, test_minute_limit_says_try_again_in_a_minute, test_structured_memo_accepts_grounded_response, test_structured_memo_rejects_invalid_contract, test_structured_memo_rejects_returned_score, test_structured_memo_rejects_decision_flag_and_roof_claims, test_coverage_review_rejects_invented_quantitative_claims
- `test_review_concurrency.py`: app_db, pending_referral, reviewer, test_a_claimed_referral_tells_the_second_reviewer_who_has_it, test_a_released_or_expired_claim_frees_the_referral, test_a_member_cannot_claim, test_the_same_address_and_pin_code_is_flagged, test_only_one_of_many_simultaneous_decisions_is_saved
- `test_risk_calculator.py`: test_low_risk_accept, test_low_risk_accept_high_seismic_zone_adds_fifteen_points, test_low_risk_accept_default_seismic_zone_preserves_score, test_mid_risk_refer, test_high_risk_auto_decline, mitigation_features, test_prototype_mitigation_baseline_with_none_fields_preserves_score, test_prototype_mitigation_sprinkler
- `test_status.py`: test_status_reports_capabilities_without_secrets, test_status_reports_qdrant_when_ai_is_configured, test_public_base_url_prefers_explicit_setting, test_maps_config_returns_key_only_when_set
- `test_store.py`: FakeRedis, BrokenRedis, test_memory_values_expire_and_counters_keep_their_first_expiry, test_redis_store_prefixes_keys_and_sets_the_expiry_once, test_a_failing_store_reads_as_empty_instead_of_raising, test_an_unreachable_redis_falls_back_to_memory, test_daily_allowance_is_counted_in_a_shared_store_without_the_database, test_daily_allowance_uses_the_database_when_the_shared_store_is_down
- `test_telemetry.py`: test_requests_are_logged_by_route_template_without_inputs, test_an_assessment_records_a_trace_with_its_steps, test_a_broken_telemetry_store_never_fails_the_request
- `test_uploads.py`: Stored, proposal, test_uploaded_photo_gets_a_random_name_inside_the_upload_folder, test_property_photo_must_be_a_real_small_image, test_live_ai_sign_in_switch
- `test_vision_extract.py`: test_no_image_returns_unavailable, test_missing_file_returns_unavailable, test_corrupt_image_returns_unusable, test_uniform_image_returns_unusable, test_missing_api_key_returns_unavailable, test_invalid_json_response_returns_unavailable, test_unexpected_keys_are_stripped, test_usable_claim_downgraded_when_no_evidence

## deploy/docker

- `api.Dockerfile`
- `nginx.conf`
- `web.Dockerfile`

## frontend

- `.gitignore`
- `.oxlintrc.json`
- `README.md`: Property Risk Assessment — React Frontend
- `index.html`
- `package.json`
- `tsconfig.app.json`
- `tsconfig.json`
- `tsconfig.node.json`
- `vite.config.ts`

## frontend/app

- `index.html`

## frontend/changelog

- `index.html`

## frontend/privacy

- `index.html`

## frontend/scripts

- `browsers.mjs`
- `build.mjs`
- `check_deprecated.mjs`
- `check_locales.mjs`
- `dev.mjs`
- `navigation.browser.mjs`
- `navigation.test.mjs`
- `navigation_browser.mjs`: tabShape, tabProblem, glassState, verifySignIn, verifyCompletion, verifyNavigation, verifyLabels, verifyTouch
- `prerender.mjs`
- `public_copy.test.mjs`
- `render_forms.mjs`
- `screenshots.mjs`
- `select_field.test.mjs`
- `typecheck.mjs`

## frontend/src

- `App.css`
- `App.tsx`: App
- `index.css`
- `main.tsx`

## frontend/src/api

- `assistant.ts`: ChatPage, ChatTurn, ChatReply, askSaathi
- `dev.ts`: DevOverview, DevArchitecture, DevRoute, DevAiCall, DevTrace, DevRetrieval, fetchDevOverview, fetchDevArchitecture
- `maps.ts`: LatLng, AddressPart, GeocodeResult, MapClick, MapInstance, MarkerInstance, MapsApi, MapsLoad
- `session.ts`: Profile, Timing, Session, Provider, Providers, fetchSession, fetchProviders, startSignIn
- `underwriting.ts`: fetchOpsSummary, fetchHistoryPage, fetchDashboard, fetchSubmissionDetail, submitUnderwriting, previewUnderwriting, checkHealth, readPaperForm
- `uploads.ts`: ImageKind, UploadLimits, uploadLimits, useUploadLimits, imageProblem

## frontend/src/components/about

- `HowItWorks.tsx`: HowItWorks

## frontend/src/components/account

- `AccountPage.tsx`: AccountPage
- `Avatar.tsx`: Avatar
- `PartnerKeys.tsx`: PartnerKeys
- `ProfileForm.tsx`: ProfileForm

## frontend/src/components/assessment

- `BackendAssessmentResult.tsx`: BackendAssessmentResult
- `HazardCard.tsx`: HazardCard
- `NewAssessment.tsx`: NewAssessment
- `PropertyMap.css`
- `PropertyMap.tsx`: PropertyMap
- `ReviewPanel.tsx`: ReviewPanel
- `RiskChart.css`
- `RiskChart.tsx`: RiskChart

## frontend/src/components/assistant

- `Mascot.tsx`: Mascot
- `Saathi.css`
- `Saathi.tsx`: Saathi

## frontend/src/components/auth

- `SessionWarning.tsx`: SessionWarning
- `SignIn.tsx`: SignIn

## frontend/src/components/dashboard

- `Dashboard.tsx`: Dashboard
- `PortfolioAnalytics.tsx`: PortfolioAnalytics

## frontend/src/components/dev

- `DevPage.css`
- `DevPage.tsx`: DevPage

## frontend/src/components/integrations

- `Integrations.tsx`: Integrations

## frontend/src/components/layout

- `Brand.tsx`: BrandMark, Brand
- `Controls.tsx`: Controls
- `LensFilter.tsx`: LensFilter
- `Sidebar.tsx`: Sidebar
- `StatusBanner.tsx`: StatusBanner
- `nav_motion.ts`: navKey, navPoint

## frontend/src/components/paper

- `PaperForm.tsx`: PaperForm

## frontend/src/components/shared

- `Card.tsx`: Card
- `Icon.tsx`: Icon
- `Loader.css`
- `Loader.tsx`: PageLoader, Spinner, TopProgress, AiProgress
- `OpticalLabel.tsx`: OpticalLabel
- `SelectField.css`
- `SelectField.tsx`: SelectField
- `SocialLinks.tsx`: SocialLinks
- `select_keys.ts`: SelectState, selectKey, placeMenu

## frontend/src/components/status

- `StatusPage.css`
- `StatusPage.tsx`: StatusPage

## frontend/src/context

- `Preferences.ts`: Vars, Preferences, PreferencesContext, usePreferences
- `PreferencesProvider.tsx`: PreferencesProvider
- `RiskContext.ts`: RiskContextState, RiskContext, useRiskContext
- `RiskProvider.tsx`: RiskProvider
- `Session.ts`: SessionState, SessionContext, useSession
- `SessionProvider.tsx`: SessionProvider
- `useSessionClock.ts`: SessionEnd, announceEnd, useSessionClock

## frontend/src/i18n

- `languages.ts`: Language, LANGUAGES

## frontend/src/landing

- `Landing.tsx`: Landing
- `glass.ts`
- `header.ts`
- `landing.css`
- `main.ts`
- `pages.tsx`: Privacy, Terms, Changelog
- `render.tsx`: render
- `site.tsx`: APP, DEMO, REPO, PORTFOLIO, Mark, SkipLink, Header, Footer
- `stack.ts`: Tool, stack
- `tabs.ts`

## frontend/src/lib

- `format.ts`: inr, inrShort
- `lens.ts`: lensAllowed, lensSupported, LensShape, BAR_SHAPE, BUBBLE_SHAPE, COPY_SHAPE, Lens, lensMap
- `social.ts`: GITHUB_PROFILE, X_PROFILE, GITHUB_PATH, X_PATH
- `speech.ts`: listenSupported, speakSupported, speechLanguage, listen, speak, stopSpeaking

## frontend/src/types

- `backend.ts`: Decision, StructuredMemo, ReviewStatus, GuidelineHit, MitigationBenefit, ProtectionAdjustment, PrototypeMitigationModel, OfficialHazard

## frontend/terms

- `index.html`

## pipeline

- `.gitignore`
- `extract.py`: Extract: copy the operational tables (Postgres or SQLite) into Parquet files in pipeline/lake/.
- `publish.py`: Publish: snapshot the dbt marts as one JSON document for the API (file + Postgres when configured).
- `requirements.txt`

## pipeline/dbt

- `dbt_project.yml`: uw_risk_analytics
- `profiles.yml`

## pipeline/dbt/models/marts

- `fct_assessments.sql`
- `mart_cat_exposure.sql`
- `mart_city_accumulation.sql`
- `mart_hazard_verification.sql`
- `mart_reference_benchmarks.sql`
- `mart_review_funnel.sql`
- `mart_risk_drivers.sql`
- `schema.yml`

## pipeline/dbt/models/staging

- `sources.yml`
- `stg_reference_properties.sql`
- `stg_submissions.sql`

## pipeline/dbt/tests

- `assert_decision_matches_score_band.sql`
- `assert_flood_share_is_a_percentage.sql`
- `assert_override_has_note.sql`
- `assert_score_in_range.sql`
- `assert_urban_flood_points_need_a_source.sql`

## pipeline/hazard

- `build_hazard.py`: Build the India pincode hazard table (seismic zone, flood share, IMD cyclone grade, NRSC landslide rank) from open government data.
- `requirements.txt`
