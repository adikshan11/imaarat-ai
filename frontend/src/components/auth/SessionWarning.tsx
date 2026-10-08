import { useEffect, useRef } from 'react'
import { usePreferences } from '@/context/Preferences'
import { useSession } from '@/context/Session'

export default function SessionWarning() {
  const { t } = usePreferences()
  const { secondsLeft, staySignedIn, signOut } = useSession()
  const dialog = useRef<HTMLDialogElement>(null)
  const open = secondsLeft !== null
  useEffect(() => {
    const node = dialog.current
    if (open && node && !node.open) node.showModal()
    if (!open && node?.open) node.close()
  }, [open])
  const time = open ? `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}` : ''

  return (
    <dialog ref={dialog} className="session-dialog" aria-labelledby="session-title" aria-describedby="session-body" onCancel={(event) => { event.preventDefault(); void staySignedIn() }}>
      <h2 id="session-title">{t('session.warning_title')}</h2>
      <p id="session-body">{t('session.warning_body', { time })}</p>
      <div className="session-actions">
        <button type="button" className="btn btn-secondary" onClick={() => { void signOut() }}>{t('auth.sign_out')}</button>
        <button type="button" className="btn btn-primary" autoFocus onClick={() => { void staySignedIn() }}>{t('session.stay')}</button>
      </div>
    </dialog>
  )
}
