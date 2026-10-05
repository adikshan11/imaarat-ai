import { usePreferences } from '@/context/Preferences'
import { useRiskContext } from '@/context/RiskContext'
import AccountPanel from '@/components/account/AccountPanel'

export default function StatusBanner() {
  const { t, language } = usePreferences()
  const { status } = useRiskContext()
  const notes = [
    status && !status.ai ? t('status.no_ai') : null,
    status && !status.persistent_storage ? t('status.ephemeral') : null,
    t('status.sample'),
    language.code !== 'en' ? t('lang.machine') : null,
  ].filter(Boolean)

  return <><div className="status-banner" role="note">{notes.join(' ')}</div><AccountPanel /></>
}
