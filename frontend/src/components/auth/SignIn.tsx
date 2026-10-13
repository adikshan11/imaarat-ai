import { useState, type SubmitEvent } from 'react'
import Controls from '@/components/layout/Controls'
import { Spinner } from '@/components/shared/Loader'
import { usePreferences } from '@/context/Preferences'
import { useSession } from '@/context/Session'

type Mode = 'login' | 'signup'
type Method = 'email' | 'mobile'

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="signin-mark">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}

export default function SignIn({ onDemo }: { onDemo: () => void }) {
  const { t } = usePreferences()
  const { providers, signIn, logIn, signUp, error, ended } = useSession()
  const [mode, setMode] = useState<Mode>('login')
  const [method, setMethod] = useState<Method>('email')
  const [name, setName] = useState('')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [going, setGoing] = useState(false)
  const signup = mode === 'signup'

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    try {
      if (signup) await signUp(name, identifier.trim(), password)
      else await logIn(identifier.trim(), password)
    } finally {
      setBusy(false)
    }
  }

  const google = () => {
    setGoing(true)
    void signIn('google')
  }

  return (
    <main className="signin-page">
      <div className="signin-controls"><Controls compact /></div>
      <section className="signin-card card" aria-labelledby="signin-title">
        <a href="/" className="signin-brand">
          <img src="/favicon.svg?v=imaarat-3" alt="" width="36" height="36" />
          <span>imaarat.ai</span>
        </a>
        <h1 id="signin-title">{t('signin.title')}</h1>
        <p className="signin-lead">{t('signin.lead')}</p>
        {ended && <p className="signin-notice" role="status">{ended.reason === 'idle' ? t('session.ended_idle', { minutes: String(Math.round(ended.timing.idle_seconds / 60)) }) : t('session.ended_max', { hours: String(Math.round(ended.timing.max_seconds / 3600)) })}</p>}
        <div className="signin-tabs" role="tablist">
          {(['login', 'signup'] as const).map((item) => (
            <button key={item} type="button" role="tab" aria-selected={mode === item} className={mode === item ? 'is-active' : undefined} onClick={() => setMode(item)}>{t(item === 'login' ? 'signin.tab_login' : 'signin.tab_signup')}</button>
          ))}
        </div>
        {error && <p className="signin-error" role="alert">{error}</p>}
        {providers.google && (
          <button type="button" className="btn signin-provider" disabled={going || busy} onClick={google}>
            {going && !error ? <Spinner /> : <GoogleMark />}
            {t(signup ? 'signin.google_signup' : 'signin.google')}
          </button>
        )}
        <div className="signin-divider"><span>{t('signin.or')}</span></div>
        <form className="signin-form" onSubmit={(event) => { void submit(event) }}>
          <div className="signin-methods" role="group">
            {(['email', 'mobile'] as const).map((item) => (
              <button key={item} type="button" aria-pressed={method === item} className={method === item ? 'is-active' : undefined} onClick={() => { setMethod(item); setIdentifier('') }}>{t(item === 'email' ? 'signin.method_email' : 'signin.method_mobile')}</button>
            ))}
          </div>
          {signup && (
            <label>
              <span>{t('signin.name')}</span>
              <input type="text" value={name} autoComplete="name" required minLength={2} maxLength={80} onChange={(event) => setName(event.target.value)} />
            </label>
          )}
          <label>
            <span>{t(method === 'email' ? 'signin.email' : 'signin.mobile')}</span>
            <input type={method === 'email' ? 'email' : 'tel'} inputMode={method === 'email' ? 'email' : 'tel'} value={identifier} autoComplete={method === 'email' ? 'email' : 'tel'} required maxLength={254} placeholder={method === 'email' ? 'name@example.com' : '+91 98765 43210'} dir="ltr" onChange={(event) => setIdentifier(event.target.value)} />
          </label>
          <label>
            <span>{t('signin.password')}</span>
            <input type="password" value={password} autoComplete={signup ? 'new-password' : 'current-password'} required minLength={signup ? 8 : 1} maxLength={128} onChange={(event) => setPassword(event.target.value)} />
            {signup && <small>{t('signin.password_hint')}</small>}
          </label>
          <button type="submit" className="btn btn-primary signin-submit" disabled={busy || going}>{busy && <Spinner />}{t(signup ? 'signin.submit_signup' : 'signin.submit_login')}</button>
        </form>
        <div className="signin-divider"><span>{t('signin.or')}</span></div>
        <button type="button" className="btn btn-secondary signin-demo" onClick={onDemo}>{t('signin.demo')}</button>
        <p className="signin-note">{t('signin.demo_note')}</p>
        <p className="signin-privacy">{t('signin.privacy')} <a href="/privacy/" lang="en">Privacy Policy</a></p>
        {providers.owner && <button type="button" className="signin-owner" lang="en" disabled={going || busy} onClick={() => { setGoing(true); void signIn('owner') }}>Owner sign-in</button>}
      </section>
    </main>
  )
}
