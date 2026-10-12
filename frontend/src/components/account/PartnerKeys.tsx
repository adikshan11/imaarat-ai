import { useEffect, useState, type SubmitEvent } from 'react'
import { Spinner } from '@/components/shared/Loader'
import { createPartnerKey, fetchPartnerKeys, revokePartnerKey, type PartnerKey } from '@/api/session'
import { usePreferences } from '@/context/Preferences'
import { useSession } from '@/context/Session'

function day(seconds: number | null): string | null {
  return seconds ? new Date(seconds * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null
}

export default function PartnerKeys() {
  const { t } = usePreferences()
  const { session } = useSession()
  const [keys, setKeys] = useState<PartnerKey[]>([])
  const [name, setName] = useState('')
  const [issued, setIssued] = useState<PartnerKey | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    fetchPartnerKeys().then(setKeys).catch((cause: Error) => setError(cause.message))
  }, [])
  if (!session) return null

  const run = async (action: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await action()
      setKeys(await fetchPartnerKeys())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  const create = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    void run(async () => {
      setIssued(await createPartnerKey(session.csrf_token, name))
      setName('')
    })
  }

  return (
    <div className="partner-keys">
      <h2>{t('partners.title')}</h2>
      <p className="field-hint">{t('partners.lead')}</p>
      <form className="partner-key-form" onSubmit={create}>
        <label>
          {t('partners.name')}
          <input value={name} onChange={(event) => setName(event.target.value)} required pattern="[a-z0-9][a-z0-9\-]{1,39}" maxLength={40} placeholder="broker-1" dir="ltr" autoComplete="off" />
        </label>
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy && <Spinner />}{t('partners.create')}</button>
      </form>
      {issued?.key && (
        <div className="partner-key-once" role="status">
          <span>{t('partners.once')}</span>
          <code dir="ltr">{issued.key}</code>
        </div>
      )}
      {error && <p className="signin-error" role="alert">{error}</p>}
      <ul className="partner-key-list">
        {keys.map((key) => (
          <li key={key.id}>
            <strong>{key.name}</strong>
            <span>{key.revoked_at ? t('partners.revoked') : t('partners.used', { created: day(key.created_at) ?? '', used: day(key.last_used_at) ?? t('partners.never') })}</span>
            {!key.revoked_at && <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => { void run(() => revokePartnerKey(session.csrf_token, key.id)) }}>{t('partners.revoke')}</button>}
          </li>
        ))}
      </ul>
    </div>
  )
}
