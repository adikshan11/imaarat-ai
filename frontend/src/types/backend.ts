export type Decision = 'Accept' | 'Refer' | 'Decline (mitigation possible)' | 'Auto-Decline'

export interface StructuredMemo {
  property_summary: string[]
  key_risk_factors: string[]
  coverage_review: string[]
  decision: string
  rationale: string
  suggested_next_steps: string[]
  guideline_citations?: string[]
}

export type ReviewStatus = 'not_required' | 'pending_review' | 'approved' | 'overridden'

export interface GuidelineHit { id: string; title: string; text: string; score: number }

export interface MitigationBenefit { factor: string; benefit: number }
export interface ProtectionAdjustment { factor: string; adjustment: number }
export interface PrototypeMitigationModel {
  model: 'prototype_mitigation_model' | string
  authoritative_score: number
  mitigation_benefit: number
  risk_adjusted_view: number
  risk_level: string
  recommendation: string
  mitigation_benefits: MitigationBenefit[]
  protection_adjustments: ProtectionAdjustment[]
  risk_profile: { id: string; name: string; score: number }[]
  positive_factors: { id: string; name: string; benefit: number }[]
}
export interface OfficialHazard {
  pincode: string
  district: string | null
  state: string | null
  district_lgd: number | null
  seismic_zone: string | null
  seismic_zone_map: string | null
  seismic_zone_max: string | null
  seismic_source: string | null
  flood_area_pct: number
  urban_flood_points: number | null
  urban_flood_source: string | null
  cyclone_grade: string | null
  cyclone_note: string | null
  built_at: string
}

export interface MitigationPreview {
  official_hazard?: OfficialHazard | null
  seismic_zone_used?: string
  risk_score: number
  authoritative_risk_score: number
  authoritative_decision?: string
  policy_type?: string | null
  risk_flags: string[]
  risk_breakdown: Record<string, number>
  prototype_mitigation_model: PrototypeMitigationModel
  mitigation_benefits: MitigationBenefit[]
  prototype_mitigation_total: number
  positive_factors: { id: string; name: string; benefit: number }[]
  risk_profile: { id: string; name: string; score: number }[]
  duplicates?: DuplicateProposal[]
}

export interface DuplicateProposal { id: number; property_id: string; decision: string; created_at: string }

export interface BackendSubmission {
  id?: number
  property_id: string
  raw_input: Record<string, unknown>
  extracted_features: Record<string, unknown>
  guideline_chunks: string[]
  risk_score: number
  risk_flags: string[]
  risk_breakdown: Record<string, number>
  prototype_mitigation_model?: PrototypeMitigationModel
  comparables: Record<string, unknown>[]
  decision: Decision | string
  rationale: string
  memo_json?: StructuredMemo
  policy_type?: string | null
  total_value_at_risk_inr?: number | null
  ai_memo_status?: 'Available' | 'Unavailable' | string
  ai_memo_reason?: string | null
  memo_model?: string
  guideline_hits?: GuidelineHit[]
  trace_url?: string | null
  review_status?: ReviewStatus
  final_decision?: string | null
  reviewer?: string | null
  review_note?: string | null
  reviewed_at?: string | null
  claimed_by?: string | null
  claimed_until?: string | null
  created_at?: string
}

export type BackendHistoryRow = Pick<
  BackendSubmission,
  | 'id'
  | 'property_id'
  | 'raw_input'
  | 'decision'
  | 'risk_score'
  | 'risk_flags'
  | 'risk_breakdown'
  | 'prototype_mitigation_model'
  | 'total_value_at_risk_inr'
  | 'review_status'
  | 'final_decision'
  | 'created_at'
>

export interface HistoryQuery {
  limit: number
  offset: number
  decision: string
  q: string
  sort: 'created' | 'property' | 'location' | 'score' | 'value'
  direction: 'asc' | 'desc'
}

export interface PortfolioSummary {
  submissions: number
  average_score: number
  pending_review: number
  total_value_inr: number
  with_sprinklers: number
  with_fire_alarm: number
  with_flood_protection: number
  mitigation_benefit: number
  decisions: Record<string, number>
  bands: Record<string, number>
  top_drivers: Array<[string, number]>
  hazard_checks?: Record<'pincode_matched' | 'declared_seismic_zone_below_official' | 'flood_history_at_pincode' | 'imd_cyclone_prone_district', number>
}

export interface OpsSpan { name: string; start_ms: number; duration_ms: number; status: string }

export interface CiRun<T> { created_at: string; git_sha: string; run_url: string; summary: T }

export interface OpsSummary {
  window_hours: number
  ci_runs: {
    load?: Array<CiRun<{ users: number; duration: string; requests: number; failures: number; rps: number; p50_ms: number; p95_ms: number; p99_ms: number; submit_p95_ms: number }>>
    lighthouse?: Array<CiRun<Record<string, { performance: number; accessibility: number; lcp_ms: number; tbt_ms: number; cls: number }>>>
    evals?: Array<CiRun<{ mode: string; passed: boolean | null; rules_agreement: number; rules_cases: number; retrieval_hit_rate: number | null; retrieval_recall: number | null; retrieval_cases: number | null; toon_token_saving: number | null; sections: Record<string, string> }>>
  }
  storage: { database_bytes: number; limit_bytes: number; tables: Array<{ table: string; bytes: number }> } | null
  generated_at: string
  process_uptime_s: number
  requests: {
    total: number
    server_errors: number
    client_errors: number
    cold_starts: number
    timeline: Array<{ bucket: string; requests: number; client_errors: number; server_errors: number }>
    routes: Array<{ route: string; count: number; error_rate: number; p50_ms: number | null; p95_ms: number | null; p99_ms: number | null }>
    error_types: Record<string, number>
  }
  ai: {
    budget: { admissions_left: number; calls_left: number; generations_left?: number; per_visitor_admissions: number; resets_in_seconds: number; tokens_today: { input: number; output: number } }
    stages: Record<string, { calls: number; succeeded: number; failed: number; input_tokens: number; output_tokens: number; p50_ms: number | null; p95_ms: number | null }>
    timeline: Array<{ bucket: string; calls: number; failed: number; tokens: number }>
    memo_outcomes: Record<string, number>
  }
  assessments: {
    total: number
    p50_ms: number | null
    p95_ms: number | null
    recent: Array<{ created_at: string; total_ms: number; memo_status: string | null; decision: string | null; spans: OpsSpan[] }>
  }
}

export interface DeploymentStatus { version: string; ai: boolean; vector_store: string; tracing: boolean; persistent_storage: boolean }

export interface FieldReading {
  value: string | number | boolean | null
  read_as: string | null
  confidence: 'high' | 'medium' | 'low'
  box_2d: number[] | null
  issue: string | null
  needs_confirmation: boolean
}
export interface FormReading { form_version: string; model?: string; fields: Record<string, FieldReading> }

export interface ReviewInput { final_decision: string; note: string }

export type MartRow = Record<string, string | number | boolean | null>
export interface AnalyticsSnapshot {
  generated_at: string
  assessments: number
  tiv_inr: number
  marts: Record<'mart_cat_exposure' | 'mart_city_accumulation' | 'mart_risk_drivers' | 'mart_review_funnel' | 'mart_reference_benchmarks', MartRow[]> & { mart_hazard_verification?: MartRow[] }
}

export interface FormatSummary {
  memos: number
  generation_attempts?: number
  failed?: number
  faithfulness_cases?: number
  citation_cases?: number
  contract_pass_rate: number | null
  faithfulness: number | null
  citation_precision: number | null
  avg_input_tokens: number | null
  avg_latency_ms: number | null
}
export interface EvalReport {
  status?: 'not_run' | 'completed' | 'failed'
  passed?: boolean | null
  run_mode?: 'not_run' | 'deterministic_only' | 'live_bounded'
  generated_at?: string | null
  model?: string
  fallback_model?: string
  judge_model?: string
  metadata?: {
    dataset?: string
    scope?: string
    chunking?: string
    corpus_sections?: number
    corpus_characters?: number
    corpus_tokens?: number | null
    token_availability?: string
    prompt_token_scope?: string
    section_characters?: Record<string, number>
    k?: number
    embedding_model?: string
    configured_vector_store?: string
    retrieval_thresholds?: { hit_rate: number; recall: number | null }
    retrieval_acceptance?: string
    faithfulness_threshold?: number
    faithfulness_denominator?: string
    memo_denominator?: string
    generation_budget_note?: string
    selected_live_cases?: string[]
    memo_generations?: number
  }
  sections?: Record<string, { status?: string; reason?: string; passed?: boolean }>
  deterministic?: { cases?: number; accuracy?: number | null; passed?: boolean; rows?: { id: string; score: number; decision: string; correct: boolean }[] } | null
  retrieval?: { k: number; cases?: number; hit_rate: number | null; recall: number | null; mrr: number | null; passed?: boolean; thresholds?: { hit_rate: number; recall: number | null }; rows?: { id: string; retrieved: string[]; relevant: string[]; hit: boolean; recall: number | null; recall_threshold?: number | null }[] } | null
  prompt_tokens?: { toon_tokens: number; json_tokens: number; saving: number | null; rows?: { id: string; toon: number; json: number }[] } | null
  memos?: { toon?: FormatSummary; json?: FormatSummary; passed?: boolean; generation_attempts?: number; rows?: { id: string; format: string; status: string; passed: boolean; reason: string; model?: string; generation_attempted?: boolean }[] } | null
}

export interface SubmissionInput {
  proposer_name?: string
  insured_legal_name?: string
  business_name?: string
  contact_person?: string
  designation?: string
  mobile?: string
  email?: string
  policy_period_start?: string
  policy_period_end?: string
  interested_parties?: string
  financial_institution?: string
  property_id: string
  address: string
  city: string
  state: string
  zip: string
  latitude: number
  longitude: number
  construction_type: string
  year_built: number
  wall_material?: string
  floor_material?: string
  roof_material?: string
  building_height_m?: number
  roof_type?: string
  roof_age_years?: number
  square_footage: number
  occupancy_type: string
  business_activity?: string
  is_manufacturing?: boolean
  manufacturing_process?: string
  is_warehouse_storage?: boolean
  goods_stored?: string
  num_stories: number
  sprinkler_system: 'Y' | 'N'
  fire_alarm?: boolean
  flood_protection?: boolean
  generator?: boolean
  drainage?: boolean
  security_protective_safeguards?: boolean
  cat_zone: string
  seismic_zone: 'II' | 'III' | 'IV' | 'V'
  rsmd_cover: boolean
  terrorism_cover?: boolean
  earthquake_cover?: boolean
  flood_cover?: boolean
  cyclone_wind_cover?: boolean
  distance_to_coast_miles?: number
  distance_to_fire_zone_miles?: number
  prior_claims_count_5yr?: number
  prior_claims_total_amount?: number
  last_loss_date?: string
  building_value_inr?: number
  plant_machinery_value_inr?: number
  furniture_fixtures_equipment_value_inr?: number
  stock_inventory_value_inr?: number
  other_contents_value_inr?: number
  contents_value_inr?: number
  business_interruption_cover?: boolean
  business_interruption_value_inr?: number
  annual_gross_profit_inr?: number
  indemnity_period_months?: number
  tiv: number
  submission_date: string
}
