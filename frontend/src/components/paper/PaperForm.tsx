import { useEffect, useRef, useState } from 'react'
import Card from '@/components/shared/Card'
import Icon from '@/components/shared/Icon'
import { readPaperForm } from '@/api/underwriting'
import { usePreferences } from '@/context/Preferences'
import type { FormReading } from '@/types/backend'

const CONSTRUCTION = ['Frame', 'Joisted Masonry', 'Non-Combustible', 'Masonry Non-Combustible', 'Fire Resistive']
const HAZARDS = ['None', 'Wind', 'Hail', 'Wildfire', 'Flood', 'Earthquake']
const ZONES = ['II', 'III', 'IV', 'V']
const TEXT_BOXES = ['address', 'city', 'state', 'occupancy_type']
const NUMBER_BOXES = ['year_built', 'num_stories', 'square_footage', 'roof_age_years', 'prior_claims_count_5yr']
const MONEY_BOXES = ['building_value_inr', 'plant_machinery_value_inr', 'stock_inventory_value_inr', 'other_contents_value_inr']
const TICKS = ['sprinkler_system', 'fire_alarm', 'flood_protection']
const NUMERIC = new Set(['zip', ...NUMBER_BOXES, ...MONEY_BOXES])
const PERSONAL = ['proposer_name', 'insured_legal_name', 'contact_person', 'mobile', 'email', 'policy_period_start', 'policy_period_end']

async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('resize failed'))), 'image/jpeg', 0.85))
}

function Crop({ image, box }: { image: HTMLImageElement | null; box: number[] | null }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const target = canvas.current
    if (!target || !image || !box || box.length !== 4) return
    const [ymin, xmin, ymax, xmax] = box.map((value) => value / 1000)
    const sx = Math.max(0, (xmin - 0.01) * image.naturalWidth)
    const sy = Math.max(0, (ymin - 0.01) * image.naturalHeight)
    const sw = Math.min(image.naturalWidth - sx, (xmax - xmin + 0.02) * image.naturalWidth)
    const sh = Math.min(image.naturalHeight - sy, (ymax - ymin + 0.02) * image.naturalHeight)
    if (sw <= 0 || sh <= 0) return
    target.width = Math.round(sw)
    target.height = Math.round(sh)
    target.getContext('2d')?.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh)
  }, [image, box])
  return box ? <canvas ref={canvas} className="paper-crop" /> : <span className="muted-text">—</span>
}

function Box({ label, english, cells = 1, tall = false }: { label: string; english?: string; cells?: number; tall?: boolean }) {
  return (
    <div className="pf-field">
      <div className="pf-label">{label}{english && english !== label ? <span className="pf-english"> · {english}</span> : null}</div>
      {cells > 1 ? <div className="pf-cells" dir="ltr">{Array.from({ length: cells }, (_, index) => <span key={index} />)}</div> : <div className={tall ? 'pf-box pf-box-tall' : 'pf-box'} />}
    </div>
  )
}

function Ticks({ label, english, options }: { label: string; english?: string; options: string[] }) {
  return (
    <div className="pf-field">
      <div className="pf-label">{label}{english && english !== label ? <span className="pf-english"> · {english}</span> : null}</div>
      <div className="pf-ticks">{options.map((option) => <span key={option}><i />{option}</span>)}</div>
    </div>
  )
}

function PrintableForm() {
  const { t, label, english, language } = usePreferences()
  const both = (key: string) => ({ label: t(key), english: language.code === 'en' ? undefined : english(key) })
  const yesNo = [t('img.used'), t('img.not_used')]
  return (
    <div className="print-area" aria-hidden="true">
      <section className="pf-page">
        <span className="pf-corner pf-tl" /><span className="pf-corner pf-tr" /><span className="pf-corner pf-bl" /><span className="pf-corner pf-br" />
        <header className="pf-head"><strong>Imaarat · {t('paper.page1')}</strong><span>IMR-PF-1 · 1/2</span></header>
        <p className="pf-keep">{t('paper.keep_page1')}</p>
        {PERSONAL.map((key) => <Box key={key} {...both(`f.${key}`)} />)}
        <Box {...both('paper.signature')} tall />
        <p className="pf-small">{t('paper.declaration')}</p>
      </section>
      <section className="pf-page">
        <span className="pf-corner pf-tl" /><span className="pf-corner pf-tr" /><span className="pf-corner pf-bl" /><span className="pf-corner pf-br" />
        <header className="pf-head"><strong>Imaarat · {t('paper.page2')}</strong><span>IMR-PF-1 · 2/2</span></header>
        <p className="pf-keep">{t('paper.upload_page2')}</p>
        <Box {...both('f.zip')} cells={6} />
        <Box {...both('f.address')} />
        <div className="pf-row">{TEXT_BOXES.slice(1).map((key) => <Box key={key} {...both(`f.${key}`)} />)}</div>
        <Ticks {...both('f.construction_type')} options={CONSTRUCTION.map((item) => label('opt.con', item))} />
        <div className="pf-row">{NUMBER_BOXES.map((key) => <Box key={key} {...both(`f.${key}`)} />)}</div>
        <Ticks {...both('f.cat_zone')} options={HAZARDS.map((item) => label('opt.cat', item))} />
        <Ticks {...both('f.seismic_zone')} options={ZONES} />
        <div className="pf-row">{TICKS.map((key) => <Ticks key={key} {...both(`f.${key}`)} options={yesNo} />)}</div>
        <div className="pf-row pf-row-2">{MONEY_BOXES.map((key) => <Box key={key} {...both(`f.${key}`)} />)}</div>
        <p className="pf-small">{t('paper.digits_hint')}</p>
      </section>
    </div>
  )
}

export default function PaperForm({ onUse }: { onUse: (values: Record<string, unknown>) => void }) {
  const { t } = usePreferences()
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reading, setReading] = useState<FormReading | null>(null)
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({})

  const upload = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setError(null)
    setReading(null)
    try {
      const small = await shrink(file)
      const picture = new Image()
      picture.src = URL.createObjectURL(small)
      await picture.decode()
      setImage(picture)
      const result = await readPaperForm(small)
      setReading(result)
      setValues(Object.fromEntries(Object.entries(result.fields).map(([name, field]) => [name, field.value === null || field.value === undefined ? '' : String(field.value)])))
      setConfirmed({})
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : ''
      setError(message.includes('switched off') ? t('paper.ai_off') : t('paper.read_failed'))
    } finally {
      setBusy(false)
    }
  }

  const pending = reading ? Object.entries(reading.fields).filter(([name, field]) => field.needs_confirmation && !confirmed[name]).length : 0
  const use = () => {
    const filled = Object.fromEntries(Object.entries(values).filter(([, value]) => value !== ''))
    onUse(filled)
  }

  return (
    <div>
      <div className="paper-screen">
        <div className="page-subtitle">{t('paper.eyebrow')}</div>
        <h1 className="page-title">{t('paper.title')}</h1>
        <p className="page-lead">{t('paper.lead')}</p>

        <div className="paper-steps">
          <Card title={`1 · ${t('paper.step_print')}`}>
            <p>{t('paper.print_help')}</p>
            <button className="btn btn-primary form-gap" onClick={() => window.print()}><Icon name="print" size={18} /> {t('paper.print')}</button>
          </Card>
          <Card title={`2 · ${t('paper.step_upload')}`}>
            <p>{t('paper.upload_help')}</p>
            <label className="checkbox-field form-gap">
              <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
              <span>{t('paper.consent')}</span>
            </label>
            <label className={consent && !busy ? 'btn btn-primary form-gap upload-button' : 'btn btn-primary form-gap upload-button is-disabled'}>
              <Icon name="camera" size={18} /> {busy ? t('paper.reading') : t('paper.upload')}
              <input type="file" accept="image/*" capture="environment" disabled={!consent || busy} onChange={(event) => void upload(event.target.files?.[0])} />
            </label>
            {error && <div className="error-banner form-gap" role="alert">{error}</div>}
          </Card>
        </div>

        {reading && <Card title={`3 · ${t('paper.step_review')}`}>
          <p aria-live="polite">{t('paper.review_help', { pending })}</p>
          <div className="table-wrap form-gap">
            <table className="paper-table">
              <thead><tr><th>{t('paper.col_field')}</th><th>{t('paper.col_photo')}</th><th>{t('paper.col_value')}</th><th>{t('paper.col_check')}</th></tr></thead>
              <tbody>{Object.entries(reading.fields).map(([name, field]) => (
                <tr key={name} className={field.issue ? 'paper-row-issue' : undefined}>
                  <td>{t(`f.${name}`)}</td>
                  <td><Crop image={image} box={field.box_2d} /></td>
                  <td>
                    <input value={values[name] ?? ''} inputMode={NUMERIC.has(name) ? 'numeric' : undefined} onChange={(event) => setValues((current) => ({ ...current, [name]: event.target.value }))} aria-label={t(`f.${name}`)} />
                    <div className="paper-meta">
                      <span className={`confidence confidence-${field.confidence}`}>{t(`paper.conf_${field.confidence}`)}</span>
                      {field.issue && <span className="paper-issue">{t(`paper.issue_${field.issue}`)}</span>}
                      {field.read_as && String(field.read_as) !== String(field.value ?? '') && <span className="muted-text">{t('paper.read_as', { text: String(field.read_as) })}</span>}
                    </div>
                  </td>
                  <td>{field.needs_confirmation ? <label className="checkbox-field"><input type="checkbox" checked={Boolean(confirmed[name])} onChange={(event) => setConfirmed((current) => ({ ...current, [name]: event.target.checked }))} /> {t('paper.confirm')}</label> : null}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div className="form-actions form-gap">
            <button className="btn btn-primary" disabled={pending > 0} onClick={use}>{t('paper.use')}</button>
          </div>
          <p className="card-footnote">{t('paper.model_note', { model: reading.model ?? '' })}</p>
        </Card>}
      </div>
      <PrintableForm />
    </div>
  )
}
