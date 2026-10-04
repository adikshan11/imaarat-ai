import { usePreferences } from '@/context/Preferences'
import { useRiskContext } from '@/context/RiskContext'

export default function StatusBanner() {
  const { t } = usePreferences()
  const { status } = useRiskContext()
  const notes = [
    status && !status.ai ? t('status.no_ai') : null,
    status && !status.persistent_storage ? t('status.ephemeral') : null,
    t('status.sample'),
  ].filter(Boolean)

  return <div className="status-banner" role="note">{notes.join(' ')}</div>
}
