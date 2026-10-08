import { usePreferences } from '@/context/Preferences'
import { useRiskContext } from '@/context/RiskContext'
import { useSession } from '@/context/Session'

export default function StatusBanner() {
  const { t, language } = usePreferences()
  const { status } = useRiskContext()
  const { session, error: signInError } = useSession()
  const demo = !session && status?.ai
  const notes = [
    signInError,
    status && !status.ai ? t('status.no_ai') : null,
    demo ? t('status.demo') : null,
    status && !status.persistent_storage ? t('status.ephemeral') : null,
    t('status.sample'),
    language.code !== 'en' ? t('lang.machine') : null,
  ].filter(Boolean)

  return <div className="status-banner" role="note">{notes.join(' ')}{demo && <> <a href="#signin">{t('auth.open_sign_in')}</a></>}</div>
}
