import { useState } from 'react'
import Card from '@/components/shared/Card'
import { reviewSubmission } from '@/api/underwriting'
import { usePreferences } from '@/context/Preferences'
import type { BackendSubmission } from '@/types/backend'

const DECISIONS = ['Accept', 'Refer', 'Decline (mitigation possible)', 'Auto-Decline']

export default function ReviewPanel({ submission, onReviewed }: { submission: BackendSubmission; onReviewed: (updated: BackendSubmission) => void }) {
  const { t, label, dev } = usePreferences()
  const [finalDecision, setFinalDecision] = useState(submission.decision)
  const [reviewer, setReviewer] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const status = submission.review_status ?? 'not_required'

  if (status === 'not_required') return null

  if (status !== 'pending_review') {
    return (
      <Card title={t('rev.done_title')}>
        <p>
          <strong>{t(status === 'overridden' ? 'rev.overridden' : 'rev.approved')}</strong> {t('rev.by', { who: submission.reviewer || t('rev.underwriter') })}
          {submission.reviewed_at ? ` ${t('rev.on', { date: submission.reviewed_at.slice(0, 10) })}` : ''}
        </p>
        <div className="risk-stack">
          <div className="risk-line"><span>{t('rev.system')}</span><strong>{label('decision', submission.decision)}</strong></div>
          <div className="risk-line"><span>{t('rev.final')}</span><strong>{label('decision', submission.final_decision ?? submission.decision)}</strong></div>
        </div>
        {submission.review_note && <p className="card-footnote">{t('rev.note', { note: submission.review_note })}</p>}
      </Card>
    )
  }

  const override = finalDecision !== submission.decision
  const submit = async () => {
    if (!submission.id) return
    setBusy(true)
    setError(null)
    try {
      onReviewed(await reviewSubmission(submission.id, { final_decision: finalDecision, reviewer: reviewer.trim(), note: note.trim() }))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('rev.error'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title={t('rev.title')} className="card-attention">
      <p>{t(dev ? 'rev.lead_dev' : 'rev.lead', { score: submission.risk_score })}</p>
      <div className="form-grid form-gap">
        <div className="form-row form-row-2">
          <label>
            <span className="field-label-text">{t('rev.final_label')}</span>
            <select value={finalDecision} onChange={(event) => setFinalDecision(event.target.value)}>
              {DECISIONS.map((decision) => <option key={decision} value={decision}>{label('decision', decision)}</option>)}
            </select>
          </label>
          <label>
            <span className="field-label-text">{t('rev.reviewer')}</span>
            <input value={reviewer} onChange={(event) => setReviewer(event.target.value)} />
          </label>
        </div>
        <label>
          <span className="field-label-text">{t('rev.note_label')} {t(override ? 'rev.note_required' : 'rev.note_optional')}</span>
          <input value={note} onChange={(event) => setNote(event.target.value)} placeholder={t('rev.note_ph')} />
        </label>
      </div>
      {error && <div className="error-banner">{error}</div>}
      <div className="form-actions form-gap">
        <button className="btn btn-primary" disabled={busy || !reviewer.trim() || (override && !note.trim())} onClick={() => void submit()}>
          {busy ? t('rev.saving') : t(override ? 'rev.override' : 'rev.approve')}
        </button>
      </div>
    </Card>
  )
}
