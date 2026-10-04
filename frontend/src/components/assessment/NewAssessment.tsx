import { useEffect, useRef, useState } from 'react'
import type { BackendSubmission, MitigationPreview, SubmissionInput } from '@/types/backend'
import { previewUnderwriting } from '@/api/underwriting'
import { useRiskContext } from '@/context/RiskContext'
import Card from '@/components/shared/Card'
import { usePreferences } from '@/context/Preferences'
import { inr } from '@/lib/format'

const optionalNumber = (value: string) => {
  if (value.trim() === '') return undefined
  const parsed = Number(value)
  return Number.isNaN(parsed) ? undefined : parsed
}

type FormState = {
  proposer_name: string
  insured_legal_name: string
  business_name: string
  contact_person: string
  designation: string
  mobile: string
  email: string
  policy_period_start: string
  policy_period_end: string
  interested_parties: string
  financial_institution: string
  property_id: string
  address: string
  city: string
  state: string
  zip: string
  latitude: string
  longitude: string
  construction_type: string
  year_built: string
  wall_material: string
  floor_material: string
  roof_material: string
  building_height_m: string
  roof_type: string
  roof_age_years: string
  square_footage: string
  occupancy_type: string
  business_activity: string
  is_manufacturing: boolean
  manufacturing_process: string
  is_warehouse_storage: boolean
  goods_stored: string
  num_stories: string
  sprinkler_system: string
  fire_alarm: boolean
  flood_protection: boolean
  generator: boolean
  drainage: boolean
  security_protective_safeguards: boolean
  cat_zone: string
  seismic_zone: string
  rsmd_cover: boolean
  terrorism_cover: boolean
  earthquake_cover: boolean
  flood_cover: boolean
  cyclone_wind_cover: boolean
  distance_to_coast_miles: string
  distance_to_fire_zone_miles: string
  prior_claims_count_5yr: string
  prior_claims_total_amount: string
  last_loss_date: string
  building_value_inr: string
  plant_machinery_value_inr: string
  furniture_fixtures_equipment_value_inr: string
  stock_inventory_value_inr: string
  other_contents_value_inr: string
  contents_value_inr: string
  business_interruption_cover: boolean
  business_interruption_value_inr: string
  annual_gross_profit_inr: string
  indemnity_period_months: string
  tiv: string
  submission_date: string
}

const componentTiv = (values: FormState) => {
  const components = [
    optionalNumber(values.building_value_inr),
    optionalNumber(values.plant_machinery_value_inr),
    optionalNumber(values.furniture_fixtures_equipment_value_inr),
    optionalNumber(values.stock_inventory_value_inr),
    optionalNumber(values.other_contents_value_inr),
  ].filter((value): value is number => value !== null && value !== undefined)
  return components.length ? components.reduce((sum, value) => sum + value, 0) : undefined
}

const initialForm: FormState = {
  proposer_name: '',
  insured_legal_name: '',
  business_name: '',
  contact_person: '',
  designation: '',
  mobile: '',
  email: '',
  policy_period_start: '',
  policy_period_end: '',
  interested_parties: '',
  financial_institution: '',
  property_id: '',
  address: '',
  city: '',
  state: '',
  zip: '',
  latitude: '',
  longitude: '',
  construction_type: 'Non-Combustible',
  year_built: '',
  wall_material: '',
  floor_material: '',
  roof_material: '',
  building_height_m: '',
  roof_type: '',
  roof_age_years: '',
  square_footage: '',
  occupancy_type: 'Office',
  business_activity: '',
  is_manufacturing: false,
  manufacturing_process: '',
  is_warehouse_storage: false,
  goods_stored: '',
  num_stories: '',
  sprinkler_system: 'Y',
  fire_alarm: false,
  flood_protection: false,
  generator: false,
  drainage: false,
  security_protective_safeguards: false,
  cat_zone: 'None',
  seismic_zone: 'II',
  rsmd_cover: false,
  terrorism_cover: false,
  earthquake_cover: false,
  flood_cover: false,
  cyclone_wind_cover: false,
  distance_to_coast_miles: '',
  distance_to_fire_zone_miles: '',
  prior_claims_count_5yr: '',
  prior_claims_total_amount: '',
  last_loss_date: '',
  building_value_inr: '',
  plant_machinery_value_inr: '',
  furniture_fixtures_equipment_value_inr: '',
  stock_inventory_value_inr: '',
  other_contents_value_inr: '',
  contents_value_inr: '',
  business_interruption_cover: false,
  business_interruption_value_inr: '',
  annual_gross_profit_inr: '',
  indemnity_period_months: '',
  tiv: '',
  submission_date: new Date().toISOString().slice(0, 10),
}

export default function NewAssessment({ onCompleted, onCancel }: { onCompleted: (result: BackendSubmission) => void; onCancel: () => void }) {
  const { submit } = useRiskContext()
  const { t, label } = usePreferences()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [images, setImages] = useState<File[]>([])
  const imageInputRef = useRef<HTMLInputElement>(null)
  const previewRequestId = useRef(0)
  const previewDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [form, setForm] = useState<FormState>(initialForm)
  const [preview, setPreview] = useState<MitigationPreview | null>(null)
  const [previewBusy, setPreviewBusy] = useState(false)
  const [hoveredSegId, setHoveredSegId] = useState<string | null>(null)

  const update = (key: keyof FormState, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }))

  const toInput = (values: FormState): SubmissionInput => {
    const derivedTiv = componentTiv(values)
    return {
      proposer_name: values.proposer_name || undefined,
      insured_legal_name: values.insured_legal_name || undefined,
      business_name: values.business_name || undefined,
      contact_person: values.contact_person || undefined,
      designation: values.designation || undefined,
      mobile: values.mobile || undefined,
      email: values.email || undefined,
      policy_period_start: values.policy_period_start || undefined,
      policy_period_end: values.policy_period_end || undefined,
      interested_parties: values.interested_parties || undefined,
      financial_institution: values.financial_institution || undefined,
      property_id: values.property_id,
      address: values.address,
      city: values.city,
      state: values.state,
      zip: values.zip,
      latitude: Number(values.latitude),
      longitude: Number(values.longitude),
      construction_type: values.construction_type,
      year_built: Number(values.year_built),
      wall_material: values.wall_material || undefined,
      floor_material: values.floor_material || undefined,
      roof_material: values.roof_material || undefined,
      building_height_m: optionalNumber(values.building_height_m),
      roof_type: values.roof_type || undefined,
      roof_age_years: optionalNumber(values.roof_age_years),
      square_footage: Number(values.square_footage),
      occupancy_type: values.occupancy_type,
      business_activity: values.business_activity || undefined,
      is_manufacturing: values.is_manufacturing,
      manufacturing_process: values.is_manufacturing ? values.manufacturing_process || undefined : undefined,
      is_warehouse_storage: values.is_warehouse_storage,
      goods_stored: values.is_warehouse_storage ? values.goods_stored || undefined : undefined,
      num_stories: Number(values.num_stories),
      sprinkler_system: values.sprinkler_system as 'Y' | 'N',
      fire_alarm: values.fire_alarm,
      flood_protection: values.flood_protection,
      generator: values.generator,
      drainage: values.drainage,
      security_protective_safeguards: values.security_protective_safeguards,
      cat_zone: values.cat_zone,
      seismic_zone: values.seismic_zone as SubmissionInput['seismic_zone'],
      rsmd_cover: values.rsmd_cover,
      terrorism_cover: values.terrorism_cover,
      earthquake_cover: values.earthquake_cover,
      flood_cover: values.flood_cover,
      cyclone_wind_cover: values.cyclone_wind_cover,
      distance_to_coast_miles: optionalNumber(values.distance_to_coast_miles),
      distance_to_fire_zone_miles: optionalNumber(values.distance_to_fire_zone_miles),
      prior_claims_count_5yr: optionalNumber(values.prior_claims_count_5yr),
      prior_claims_total_amount: optionalNumber(values.prior_claims_total_amount),
      last_loss_date: values.last_loss_date || undefined,
      building_value_inr: optionalNumber(values.building_value_inr),
      plant_machinery_value_inr: optionalNumber(values.plant_machinery_value_inr),
      furniture_fixtures_equipment_value_inr: optionalNumber(values.furniture_fixtures_equipment_value_inr),
      stock_inventory_value_inr: optionalNumber(values.stock_inventory_value_inr),
      other_contents_value_inr: optionalNumber(values.other_contents_value_inr),
      contents_value_inr: optionalNumber(values.contents_value_inr),
      business_interruption_cover: values.business_interruption_cover,
      business_interruption_value_inr: values.business_interruption_cover ? optionalNumber(values.business_interruption_value_inr) : undefined,
      annual_gross_profit_inr: values.business_interruption_cover ? optionalNumber(values.annual_gross_profit_inr) : undefined,
      indemnity_period_months: values.business_interruption_cover ? optionalNumber(values.indemnity_period_months) : undefined,
      tiv: derivedTiv ?? optionalNumber(values.tiv) ?? 0,
      submission_date: new Date().toISOString().slice(0, 10),
    }
  }

  const recalculate = async (values: FormState) => {
    const requestId = previewRequestId.current + 1
    previewRequestId.current = requestId
    setPreviewBusy(true)
    try {
      const nextPreview = await previewUnderwriting(toInput(values))
      if (requestId === previewRequestId.current) {
        setPreview(nextPreview)
      }
    } catch {
      if (requestId === previewRequestId.current) {
        setPreview(null)
      }
    } finally {
      if (requestId === previewRequestId.current) {
        setPreviewBusy(false)
      }
    }
  }

  // Debounced: fires for every form field change — backend computes all scoring.
  useEffect(() => {
    if (previewDebounce.current) clearTimeout(previewDebounce.current)
    previewDebounce.current = setTimeout(() => void recalculate(form), 350)
    return () => { if (previewDebounce.current) clearTimeout(previewDebounce.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form])


  const submitForm = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const selectedImages = Array.from(imageInputRef.current?.files ?? images)
      onCompleted(await submit(toInput(form), selectedImages))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('new.error'))
    } finally {
      setBusy(false)
    }
  }

  const Field = ({ name, type = 'text', optional = false, hint, required: fieldRequired }: { name: keyof FormState; type?: string; optional?: boolean; hint?: string; required?: boolean }) => (
    <label>
      <span className="field-label-text">{t(`f.${name}`)}{optional ? ` ${t('f.optional')}` : ''}</span>
      <input type={type} value={String(form[name])} onChange={(event) => update(name, event.target.value)} required={fieldRequired ?? !optional} />
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  )

  // Professional insurance RAG palette: red = catastrophic, amber = structural, teal = mitigatable, green = positive
  const SEGMENT_COLORS: Record<string, string> = {
    climate: '#EA580C', cat: '#DC2626', construction: '#D97706',
    occupancy: '#CA8A04', protection: '#0F766E', loss: '#7C3AED',
    age: '#6B7280', mitigation: '#16A34A',
  }
  const previewModel = preview?.prototype_mitigation_model
  const backendRiskProfile = previewModel?.risk_profile ?? []
  const previewProfile = previewModel?.mitigation_benefit
    ? [...backendRiskProfile, { id: 'mitigation', name: 'Mitigation benefit', score: previewModel.mitigation_benefit }]
    : backendRiskProfile
  const previewTotal = previewProfile.reduce((sum, item) => sum + Math.abs(item.score), 0)
  let previewOffset = 0
  const previewGradient = previewTotal ? previewProfile.map((item) => {
    const color = SEGMENT_COLORS[item.id] ?? '#94a3b8'
    const start = (previewOffset / previewTotal) * 100
    previewOffset += Math.abs(item.score)
    return `${color} ${start}% ${(previewOffset / previewTotal) * 100}%`
  }).join(', ') : '#e5e7eb 0 100%'
  const previewBadge = previewModel?.recommendation ?? 'Preview'
  const riskLevel = previewModel?.risk_level ?? 'Pending'
  const catExposure = previewProfile.find((item) => item.id === 'cat')?.score ?? 0
  const climateRisk = previewProfile.find((item) => item.id === 'climate')?.score ?? 0
  const protectionRisk = previewProfile.find((item) => item.id === 'protection')?.score ?? 0
  const derivedTiv = componentTiv(form)
  const displayedTiv = derivedTiv ?? optionalNumber(form.tiv)

  // Pre-compute SVG donut arc segments; each <g> supports per-segment hover
  const SVG_R = 46, SVG_SW = 16
  const svgCirc = 2 * Math.PI * SVG_R
  let svgAccum = 0
  const svgSegs = previewProfile.filter(s => s.score > 0).map(s => {
    const frac = previewTotal > 0 ? s.score / previewTotal : 0
    const acc = svgAccum; svgAccum += frac
    return { ...s, frac, acc }
  })
  const hoveredSeg = svgSegs.find(s => s.id === hoveredSegId) ?? null
  const previewCard = previewModel && <div className="preview-card" data-testid="mitigation-preview">
    <div className="preview-header-row">
      <div>
        <div className="preview-eyebrow">{t('pv.eyebrow')}</div>
        <div className="donut-svg-wrap" data-testid="risk-donut">
          <svg width="120" height="120" viewBox="0 0 120 120" aria-label={t('pv.chart')}>
            <circle className="donut-track" cx="60" cy="60" r={SVG_R} fill="none" strokeWidth={SVG_SW} />
            {svgSegs.map(seg => (
              <g key={seg.id} transform={`rotate(${seg.acc * 360 - 90} 60 60)`}
                 onMouseEnter={() => setHoveredSegId(seg.id)}
                 onMouseLeave={() => setHoveredSegId(null)}
                 style={{ cursor: 'pointer' }}>
                <circle cx="60" cy="60" r={SVG_R} fill="none"
                  stroke={SEGMENT_COLORS[seg.id] ?? '#94a3b8'}
                  strokeWidth={hoveredSegId === seg.id ? SVG_SW + 5 : SVG_SW}
                  strokeDasharray={`${seg.frac * svgCirc} ${svgCirc}`}
                  style={{ transition: 'stroke-width 0.15s ease' }} />
              </g>
            ))}
            {/* Indicative view center — this number changes when protection controls are toggled */}
            <text x="60" y="54" textAnchor="middle" fontSize="23" fontWeight="800" fill="currentColor" data-testid="risk-score">{previewModel.risk_adjusted_view}</text>
            <text x="60" y="67" textAnchor="middle" fontSize="8" fontWeight="600" className="donut-caption" letterSpacing="0.5">{t('pv.indicative')}</text>
          </svg>
          {hoveredSeg && (
            <div className="donut-tooltip">
              <span className="tooltip-swatch" style={{ background: SEGMENT_COLORS[hoveredSeg.id] ?? '#94a3b8' }} />
              {label('seg', hoveredSeg.id)}: <strong>{t('pv.points', { value: hoveredSeg.score })}</strong>
            </div>
          )}
        </div>
        <div className="auth-score-ref">{t('pv.authoritative')}: <strong data-testid="auth-score">{preview.authoritative_risk_score}</strong></div>
      </div>
      <div className="preview-verdict">
        <div className="preview-badge" data-testid="risk-badge">{label('reco', previewBadge)}</div>
        <div className="preview-level">{label('level', riskLevel)}</div>
      </div>
    </div>
    <div className="preview-call-box">
      <div className="preview-call-label">{t('pv.decision')}</div>
      <div className="preview-call-value">{t('pv.call', { decision: preview.authoritative_decision ? label('decision', preview.authoritative_decision) : label('reco', previewBadge), score: preview.authoritative_risk_score })}</div>
      <div className="prototype-view-note">{t('pv.view', { value: previewModel.risk_adjusted_view })}</div>
    </div>
    {previewModel.positive_factors.length > 0 && <div className="preview-section-head">{t('pv.positive')}</div>}
    {previewModel.positive_factors.map((item) => (
      <div className="risk-line" key={item.id}><span>{label('factor', item.id)}</span><strong>+{item.benefit}</strong></div>
    ))}
    {(() => {
      const captured = previewModel.mitigation_benefits.filter(item => item.benefit === 0)
      if (!captured.length) return null
      return <div className="captured-controls">
        <span className="captured-label">{t('pv.captured')}</span>
        <span className="captured-names">{captured.map(c => label('factor', c.factor)).join(' · ')}</span>
      </div>
    })()}
    <div className="preview-mitigation-total" data-testid="mitigation-total">{t('pv.total', { value: previewModel.mitigation_benefit })}</div>
    <div className="preview-product-segment"><span>{t('pv.segment')}</span><strong>{preview?.policy_type ? preview.policy_type.replace('/', ' / ') : t('res.not_available')}</strong></div>
    {previewBusy && <div className="notice">{t('pv.recalc')}</div>}
  </div>

  return <div>
    <div className="page-subtitle">{t('new.eyebrow')}</div>
    <h1 className="page-title">{t('new.title')}</h1>
    <p className="page-lead">{t('new.lead')}</p>
    <form onSubmit={submitForm} className="two-col">
      <div className="left-col">
        <Card title={t('sec.insured')}>
          <div className="form-grid">
            <div className="form-row form-row-2"><Field name="proposer_name" required={false} /><Field name="insured_legal_name" required={false} /></div>
            <div className="form-row form-row-2"><Field name="business_name" required={false} /><Field name="contact_person" required={false} /></div>
            <div className="form-row form-row-2"><Field name="mobile" required={false} /><Field name="email" type="email" required={false} /></div>
            <div className="form-row form-row-2"><Field name="policy_period_start" type="date" required={false} /><Field name="policy_period_end" type="date" required={false} /></div>
          </div>
          <details className="coverage-details" style={{ marginTop: 14 }}>
            <summary>{t('new.more_policy')}</summary>
            <div className="form-grid" style={{ marginTop: 12 }}>
              <Field name="designation" required={false} />
              <div className="form-row form-row-2"><Field name="interested_parties" required={false} /><Field name="financial_institution" required={false} /></div>
            </div>
          </details>
        </Card>

        <Card title={t('sec.property')}>
          <div className="form-grid">
            <Field name="property_id" />
            <Field name="address" />
            <div className="form-row form-row-3"><Field name="city" /><Field name="state" /><Field name="zip" /></div>
            <div className="form-row form-row-2"><Field name="latitude" type="number" /><Field name="longitude" type="number" /></div>
          </div>
        </Card>

        <Card title={t('sec.business')}>
          <div className="form-grid">
            <div className="form-row form-row-2"><label><span className="field-label-text">{t('f.occupancy_type')}</span><input value={form.occupancy_type} onChange={(event) => update('occupancy_type', event.target.value)} required /></label><Field name="business_activity" optional /></div>
            <div className="form-row form-row-2"><label className="checkbox-field"><input type="checkbox" checked={form.is_manufacturing} onChange={(event) => update('is_manufacturing', event.target.checked)} /> {t('f.is_manufacturing')}</label><label className="checkbox-field"><input type="checkbox" checked={form.is_warehouse_storage} onChange={(event) => update('is_warehouse_storage', event.target.checked)} /> {t('f.is_warehouse_storage')}</label></div>
            {form.is_manufacturing && <Field name="manufacturing_process" optional />}
            {form.is_warehouse_storage && <Field name="goods_stored" optional />}
          </div>
        </Card>

        <Card title={t('sec.building')}>
          <div className="form-grid">
            <div className="form-row form-row-2"><label><span className="field-label-text">{t('f.construction_type')}</span><select value={form.construction_type} onChange={(event) => update('construction_type', event.target.value)}>{['Frame', 'Joisted Masonry', 'Non-Combustible', 'Masonry Non-Combustible', 'Fire Resistive'].map((item) => <option key={item} value={item}>{label('opt.con', item)}</option>)}</select></label><Field name="year_built" type="number" /></div>
            <div className="form-row form-row-3"><Field name="square_footage" type="number" /><Field name="num_stories" type="number" /><Field name="building_height_m" type="number" optional /></div>
            <div className="form-row form-row-3"><Field name="wall_material" optional /><Field name="floor_material" optional /><Field name="roof_material" optional /></div>
            <div className="form-row form-row-2"><Field name="roof_type" optional /><Field name="roof_age_years" type="number" optional /></div>
          </div>
        </Card>

        <Card title={t('sec.hazards')}>
          <div className="form-grid">
            <div className="form-row form-row-2"><label><span className="field-label-text">{t('f.cat_zone')}</span><select value={form.cat_zone} onChange={(event) => update('cat_zone', event.target.value)}>{['None', 'Wind', 'Hail', 'Wildfire', 'Flood', 'Earthquake'].map((item) => <option key={item} value={item}>{label('opt.cat', item)}</option>)}</select></label><label><span className="field-label-text">{t('f.seismic_zone')}</span><select value={form.seismic_zone} onChange={(event) => update('seismic_zone', event.target.value)}>{['II', 'III', 'IV', 'V'].map((item) => <option key={item}>{item}</option>)}</select></label></div>
            <div className="form-row form-row-2">
              <Field name="distance_to_coast_miles" type="number" optional hint={t('hint.coast')} />
              <Field name="distance_to_fire_zone_miles" type="number" optional hint={t('hint.fire')} />
            </div>
          </div>
        </Card>

        <Card title={t('sec.protection')}>
          <div className="protection-split">
            <div className="checkbox-list">
              <label className="checkbox-field"><input type="checkbox" checked={form.sprinkler_system === 'Y'} onChange={(event) => update('sprinkler_system', event.target.checked ? 'Y' : 'N')} /> {t('f.sprinkler_system')}</label>
              <label className="checkbox-field"><input type="checkbox" checked={form.fire_alarm} onChange={(event) => update('fire_alarm', event.target.checked)} /> {t('f.fire_alarm')}</label>
              <label className="checkbox-field"><input type="checkbox" checked={form.flood_protection} onChange={(event) => update('flood_protection', event.target.checked)} /> {t('f.flood_protection')}</label>
              <label className="checkbox-field"><input type="checkbox" checked={form.generator} onChange={(event) => update('generator', event.target.checked)} /> {t('f.generator')}</label>
              <label className="checkbox-field"><input type="checkbox" checked={form.drainage} onChange={(event) => update('drainage', event.target.checked)} /> {t('f.drainage')}</label>
              <label className="checkbox-field"><input type="checkbox" checked={form.security_protective_safeguards} onChange={(event) => update('security_protective_safeguards', event.target.checked)} /> {t('f.security_protective_safeguards')}</label>
            </div>
            {previewCard}
          </div>
          <details className="coverage-details">
            <summary>{t('cover.title')}</summary>
            <div className="coverage-note">{t('cover.note')}</div>
            <div className="form-grid">
              <div className="coverage-group-label">{t('cover.perils')}</div>
              <div className="form-row form-row-2">
                <label className="checkbox-field"><input type="checkbox" checked={form.rsmd_cover} onChange={(event) => update('rsmd_cover', event.target.checked)} /> {t('f.rsmd_cover')}</label>
                <label className="checkbox-field"><input type="checkbox" checked={form.flood_cover} onChange={(event) => update('flood_cover', event.target.checked)} /> {t('f.flood_cover')}</label>
              </div>
              <div className="form-row form-row-2">
                <label className="checkbox-field"><input type="checkbox" checked={form.cyclone_wind_cover} onChange={(event) => update('cyclone_wind_cover', event.target.checked)} /> {t('f.cyclone_wind_cover')}</label>
                <label className="checkbox-field"><input type="checkbox" checked={form.earthquake_cover} onChange={(event) => update('earthquake_cover', event.target.checked)} /> {t('f.earthquake_cover')}</label>
              </div>
              <div className="form-row form-row-2">
                <label className="checkbox-field"><input type="checkbox" checked={form.terrorism_cover} onChange={(event) => update('terrorism_cover', event.target.checked)} /> {t('f.terrorism_cover')} <span className="coverage-dep-note">{t('cover.terrorism_note')}</span></label>
              </div>
              <div className="coverage-group-label coverage-group-consequential">{t('cover.consequential')}</div>
              <label className="checkbox-field"><input type="checkbox" checked={form.business_interruption_cover} onChange={(event) => update('business_interruption_cover', event.target.checked)} /> {t('f.business_interruption_cover')}</label>
              {form.business_interruption_cover && <><Field name="business_interruption_value_inr" type="number" optional /><Field name="annual_gross_profit_inr" type="number" optional /><Field name="indemnity_period_months" type="number" optional /></>}
            </div>
          </details>
        </Card>

        <Card title={t('sec.values')}>
          <div className="form-grid">
            <div className="notice">{t('values.note')}</div>
            <div className="form-row form-row-2"><Field name="building_value_inr" type="number" /><Field name="plant_machinery_value_inr" type="number" /></div>
            <div className="form-row form-row-2"><Field name="furniture_fixtures_equipment_value_inr" type="number" /><Field name="stock_inventory_value_inr" type="number" /></div>
            <Field name="other_contents_value_inr" type="number" />
            <div className="derived-value"><span>{t('values.total')}</span><strong>{displayedTiv ? inr(displayedTiv) : '—'}</strong></div>
          </div>
        </Card>

        <Card title={t('sec.loss')}>
          <div className="form-grid"><Field name="prior_claims_count_5yr" type="number" optional /><Field name="prior_claims_total_amount" type="number" optional /><Field name="last_loss_date" type="date" optional /><div className="derived-value"><span>{t('f.submission_date')}</span><strong>{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</strong></div></div>
        </Card>

        <Card title={t('sec.images')}>
          <div className="upload-zone" onClick={() => imageInputRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); setImages(Array.from(e.dataTransfer.files)) }}>
            <div className="upload-zone-icon">⬆</div>
            <div className="upload-zone-text">{t('upload.text')}</div>
            <div className="upload-zone-hint">{t('upload.hint')}</div>
          </div>
          <input ref={imageInputRef} type="file" accept="image/png,image/jpeg" multiple style={{ display: 'none' }} onChange={(event) => setImages(Array.from(event.currentTarget.files ?? []))} />
          {images.length > 0 && <div className="image-grid">{images.map((image) => <img key={image.name + image.size} src={URL.createObjectURL(image)} alt={image.name} />)}</div>}
          {images.length > 1 && <p className="notice">{t('upload.multi')}</p>}
        </Card>
      </div>

      <aside className="right-panel">
        <div className="form-actions-panel">
          {error && <div className="error-banner">{error}</div>}
          <button type="button" className="btn btn-secondary" style={{ width: '100%', marginBottom: 8 }} onClick={onCancel}>{t('new.cancel')}</button>
          <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy}>{busy ? t('new.submitting') : t('new.submit')}</button>
        </div>
      </aside>
    </form>
  </div>
}
