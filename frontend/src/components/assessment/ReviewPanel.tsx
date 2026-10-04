import { useState } from 'react'
import Card from '@/components/shared/Card'
import { reviewSubmission } from '@/api/underwriting'
import type { BackendSubmission } from '@/types/backend'

const DECISIONS = ['Accept', 'Refer', 'Decline (mitigation possible)', 'Auto-Decline']

export default function ReviewPanel({ submission, onReviewed }: { submission: BackendSubmission; onReviewed: (updated: BackendSubmission) => void }) {
  const [finalDecision, setFinalDecision] = useState(submission.decision)
  const [reviewer, setReviewer] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const status = submission.review_status ?? 'not_required'

  if (status === 'not_required') return null

  if (status !== 'pending_review') {
    return (
      <Card title="Underwriter review">
        <p>
          <strong>{status === 'overridden' ? 'Overridden' : 'Approved'}</strong> by {submission.reviewer || 'underwriter'}
          {submission.reviewed_at ? ` on ${submission.reviewed_at.slice(0, 10)}` : ''}: system decision <strong>{submission.decision}</strong>, final decision <strong>{submission.final_decision}</strong>.
        </p>
        {submission.review_note && <p className="card-footnote">Note: {submission.review_note}</p>}
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
      setError(cause instanceof Error ? cause.message : 'Review could not be saved')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title="Underwriter review required">
      <p>
        The engine referred this property (score {submission.risk_score}). The LangGraph workflow is paused at the review step until an underwriter
        approves the referral or overrides it.
      </p>
      <div className="form-grid" style={{ marginTop: 12 }}>
        <div className="form-row form-row-2">
          <label>
            <span className="field-label-text">Final decision</span>
            <select value={finalDecision} onChange={(event) => setFinalDecision(event.target.value)}>
              {DECISIONS.map((decision) => <option key={decision}>{decision}</option>)}
            </select>
          </label>
          <label>
            <span className="field-label-text">Reviewer</span>
            <input value={reviewer} onChange={(event) => setReviewer(event.target.value)} placeholder="Your name" />
          </label>
        </div>
        <label>
          <span className="field-label-text">Note{override ? ' (required for an override)' : ' (optional)'}</span>
          <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Why you approve or override" />
        </label>
      </div>
      {error && <div className="error-banner">{error}</div>}
      <div className="form-actions" style={{ marginTop: 12 }}>
        <button className="btn btn-primary" disabled={busy || !reviewer.trim() || (override && !note.trim())} onClick={() => void submit()}>
          {busy ? 'Saving...' : override ? 'Override decision' : 'Approve referral'}
        </button>
      </div>
    </Card>
  )
}
