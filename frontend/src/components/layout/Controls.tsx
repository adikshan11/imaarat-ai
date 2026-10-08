import { useRef } from 'react'
import Icon from '@/components/shared/Icon'
import OpticalLabel from '@/components/shared/OpticalLabel'
import { usePreferences } from '@/context/Preferences'
import { useSession } from '@/context/Session'
import { LANGUAGES } from '@/i18n/languages'

export default function Controls({ compact = false }: { compact?: boolean }) {
  const { t, language, setLanguage, dark, toggleTheme } = usePreferences()
  const { session, signOut } = useSession()
  const account = session ? t('auth.signed_in', { role: t(`auth.role.${session.role}`) }) : t('auth.open_sign_in')
  const dialog = useRef<HTMLDialogElement>(null)
  const themeLabel = `${t('theme.label')}: ${t(dark ? 'theme.light' : 'theme.dark')}`

  return (
    <div className={compact ? 'controls controls-compact' : 'controls'}>
      <button type="button" className="control-button control-language" onClick={() => dialog.current?.showModal()} title={t('lang.label')} aria-label={`${t('lang.label')}: ${language.english}`}>
        <Icon name="globe" />
        <OpticalLabel lang={language.code} text={language.name} />
      </button>
      <button type="button" className="control-button" onClick={toggleTheme} title={themeLabel} aria-label={themeLabel}>
        <Icon name={dark ? 'sun' : 'moon'} />
      </button>
      <button type="button" className={session ? 'control-button is-signed-in' : 'control-button'} onClick={() => { if (session) void signOut(); else window.location.hash = 'signin' }} title={session ? `${account} · ${t('auth.sign_out')}` : account} aria-label={session ? `${account}. ${t('auth.sign_out')}` : account}>
        <Icon name="user" />
      </button>

      <dialog ref={dialog} className="language-dialog" aria-label={t('lang.label')} onKeyDown={(event) => { if (event.key === 'Escape') dialog.current?.close() }} onClick={(event) => { if (event.target === dialog.current) dialog.current?.close() }}>
        <div className="language-dialog-head">
          <strong>{t('lang.label')}</strong>
          <button type="button" className="control-button" onClick={() => dialog.current?.close()} aria-label={t('new.cancel')}><Icon name="close" /></button>
        </div>
        <div className="language-dialog-body">
          <div className="language-grid">
            {LANGUAGES.map((item) => (
              <button
                type="button"
                key={item.code}
                className={item.code === language.code ? 'language-option is-current' : 'language-option'}
                aria-pressed={item.code === language.code}
                onClick={() => { setLanguage(item.code); dialog.current?.close() }}
              >
                <span lang={item.code} className="language-native">{item.name}</span>
                <span className="language-english">{item.english}{item.draft ? ' · draft' : ''}</span>
              </button>
            ))}
          </div>
          <p className="card-footnote">{t('lang.machine')}</p>
        </div>
      </dialog>
    </div>
  )
}
