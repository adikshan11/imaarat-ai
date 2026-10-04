export type Decision = 'Accept' | 'Refer' | 'Decline (mitigation possible)' | 'Auto-Decline'

export interface StructuredMemo {
  property_summary: string[]
  key_risk_factors: string[]
  coverage_review: string[]
  decision: string
  rationale: string
  suggested_next_steps: string[]
}

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
export interface MitigationPreview {
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
  | 'created_at'
>

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
