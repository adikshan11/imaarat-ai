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
  seismic_zone_max: string | null
  flood_area_pct: number
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
}

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

export interface ReviewInput { final_decision: string; reviewer: string; note: string }

export type MartRow = Record<string, string | number | boolean | null>
export interface AnalyticsSnapshot {
  generated_at: string
  assessments: number
  tiv_inr: number
  marts: Record<'mart_cat_exposure' | 'mart_city_accumulation' | 'mart_risk_drivers' | 'mart_review_funnel' | 'mart_reference_benchmarks', MartRow[]> & { mart_hazard_verification?: MartRow[] }
}

export interface FormatSummary {
  memos: number
  contract_pass_rate: number
  faithfulness: number | null
  citation_precision: number | null
  avg_input_tokens: number | null
  avg_latency_ms: number | null
}
export interface EvalReport {
  generated_at: string
  model: string
  fallback_model: string
  judge_model: string
  deterministic: { cases: number; accuracy: number; rows: { id: string; score: number; decision: string; correct: boolean }[] }
  retrieval: { k: number; hit_rate: number; recall: number; mrr: number; rows: { id: string; retrieved: string[]; relevant: string[]; hit: boolean; recall: number }[] } | null
  prompt_tokens: { toon_tokens: number; json_tokens: number; saving: number; rows: { id: string; toon: number; json: number }[] } | null
  memos: { toon: FormatSummary; json: FormatSummary } | null
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
