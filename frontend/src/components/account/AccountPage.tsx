import Icon from '@/components/shared/Icon'
import ProfileForm from '@/components/account/ProfileForm'
import { usePreferences } from '@/context/Preferences'
import { useSession } from '@/context/Session'

export default function AccountPage() {
  const { t } = usePreferences()
  const { session, signOut } = useSession()
  if (!session) return null
  return (
    <div className="account-page">
      <div className="page-subtitle">{t('auth.signed_in', { role: t(`auth.role.${session.role}`) })}</div>
      <h1 className="page-title">{t('account.settings')}</h1>
      <p className="page-lead">{t('account.lead')}</p>
      <section className="card account-card"><ProfileForm /></section>
      <section className="card account-card">
        <button type="button" className="btn btn-secondary" onClick={() => { void signOut() }}><Icon name="logout" size={18} />{t('auth.sign_out')}</button>
      </section>
    </div>
  )
}
