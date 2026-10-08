import { useState } from 'react'
import Card from '@/components/shared/Card'
import { Spinner } from '@/components/shared/Loader'
import SelectField from '@/components/shared/SelectField'
import { claimSubmission, fetchSubmissionDetail, releaseSubmission, reviewSubmission } from '@/api/underwriting'
import { usePreferences } from '@/context/Preferences'
import { useSession } from '@/context/Session'
import type { BackendSubmission } from '@/types/backend'

const DECISIONS = ['Accept', 'Refer', 'Decline (mitigation possible)', 'Auto-Decline']

export default function ReviewPanel({ submission, onReviewed }: { submission: BackendSubmission; onReviewed: (updated: BackendSubmission) => void }) {
  const { t, label, language } = usePreferences()
  const { session, reviewer: canReview, signIn } = useSession()
  const [finalDecision, setFinalDecision] = useState(submission.decision)
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
  const holder = submission.claimed_by ?? null
  const mine = Boolean(holder && session?.name && holder === `@${session.name}`)
  const heldByOther = Boolean(holder && !mine)
  const until = submission.claimed_until ? new Date(submission.claimed_until).toLocaleTimeString(language.code, { hour: '2-digit', minute: '2-digit' }) : ''
  const act = async (call: (id: number, csrf: string) => Promise<BackendSubmission>) => {
    if (!submission.id || !session) return
    setBusy(true)
    setError(null)
    try {
      onReviewed(await call(submission.id, session.csrf_token))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('rev.error'))
      onReviewed(await fetchSubmissionDetail(submission.id).catch(() => submission))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title={t('rev.title')} className="card-attention">
      <p>{t('rev.lead', { score: submission.risk_score })}</p>
      {holder && <p className="notice" role="status">{mine ? t('rev.claimed_you', { time: until }) : t('rev.claimed', { who: holder, time: until })}</p>}
      <div className="form-grid form-gap">
        <SelectField label={t('rev.final_label')} value={finalDecision} onChange={setFinalDecision} options={DECISIONS.map((decision) => ({ value: decision, label: label('decision', decision) }))} />
        <label>
          <span className="field-label-text">{t('rev.note_label')} {t(override ? 'rev.note_required' : 'rev.note_optional')}</span>
          <input value={note} onChange={(event) => setNote(event.target.value)} placeholder={t('rev.note_ph')} />
        </label>
      </div>
      {canReview && session?.name && <p className="card-footnote">{t('rev.signing_as', { who: `@${session.name}` })}</p>}
      {error && <div className="error-banner">{error}</div>}
      {!canReview && <p className="card-footnote">{t(session ? 'auth.need_reviewer_role' : 'auth.need_reviewer')}</p>}
      <div className="form-actions form-gap">
        {canReview && !holder && <button className="btn btn-secondary" disabled={busy} onClick={() => void act(claimSubmission)}>{t('rev.claim')}</button>}
        {canReview && mine && <button className="btn btn-secondary" disabled={busy} onClick={() => void act(releaseSubmission)}>{t('rev.release')}</button>}
        {canReview
          ? <button className="btn btn-primary" disabled={busy || heldByOther || (override && !note.trim())} onClick={() => void act((id, csrf) => reviewSubmission(id, { final_decision: finalDecision, note: note.trim() }, csrf))}>
              {busy ? <><Spinner />{t('rev.saving')}</> : t(override ? 'rev.override' : 'rev.approve')}
            </button>
          : !session && <button className="btn btn-primary" onClick={() => void signIn()}>{t('auth.sign_in')}</button>}
      </div>
    </Card>
  )
}
