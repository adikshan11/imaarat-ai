import Controls from '@/components/layout/Controls'
import ProfileForm from '@/components/account/ProfileForm'
import { usePreferences } from '@/context/Preferences'
import { useSession } from '@/context/Session'

export default function Onboarding() {
  const { t } = usePreferences()
  const { signOut } = useSession()
  return (
    <main className="signin-page">
      <div className="signin-controls"><Controls compact /></div>
      <section className="signin-card card profile-card" aria-labelledby="profile-title">
        <a href="/" className="signin-brand">
          <img src="/favicon.svg?v=imaarat-3" alt="" width="36" height="36" />
          <span>imaarat.ai</span>
        </a>
        <h1 id="profile-title">{t('profile.title')}</h1>
        <p className="signin-lead">{t('profile.lead')}</p>
        <ProfileForm onboarding />
        <button type="button" className="profile-signout" onClick={() => { void signOut() }}>{t('auth.sign_out')}</button>
      </section>
    </main>
  )
}
