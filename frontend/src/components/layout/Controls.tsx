import { useId, useRef } from 'react'
import Avatar from '@/components/account/Avatar'
import Icon from '@/components/shared/Icon'
import OpticalLabel from '@/components/shared/OpticalLabel'
import { usePreferences } from '@/context/Preferences'
import { useSession } from '@/context/Session'
import { LANGUAGES } from '@/i18n/languages'

const MENU_WIDTH = 248

export default function Controls({ compact = false, onAccount }: { compact?: boolean; onAccount?: () => void }) {
  const { t, language, setLanguage, dark, toggleTheme } = usePreferences()
  const { session, signOut } = useSession()
  const account = session ? t('auth.signed_in', { role: t(`auth.role.${session.role}`) }) : t('auth.open_sign_in')
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const themeLabel = `${t('theme.label')}: ${t(dark ? 'theme.light' : 'theme.dark')}`
  const shownName = session?.profile?.full_name || session?.name || t('account.menu')
  const place = () => {
    const box = trigger.current?.getBoundingClientRect()
    const node = menu.current
    if (!box || !node) return
    const start = compact || language.rtl ? box.right - MENU_WIDTH : box.left
    node.style.left = `${Math.max(8, Math.min(start, window.innerWidth - MENU_WIDTH - 8))}px`
    node.style.top = compact ? `${box.bottom + 8}px` : 'auto'
    node.style.bottom = compact ? 'auto' : `${window.innerHeight - box.top + 8}px`
  }
  const choose = (action: () => void) => {
    menu.current?.hidePopover()
    action()
  }

  return (
    <div className={compact ? 'controls controls-compact' : 'controls'}>
      <button type="button" className="control-button control-language" onClick={() => dialog.current?.showModal()} title={t('lang.label')} aria-label={`${t('lang.label')}: ${language.english}`}>
        <Icon name="globe" />
        <OpticalLabel lang={language.code} text={language.name} />
      </button>
      <button type="button" className="control-button" onClick={toggleTheme} title={themeLabel} aria-label={themeLabel}>
        <Icon name={dark ? 'sun' : 'moon'} />
      </button>
      {session ? (
        <>
          <button ref={trigger} type="button" className="control-button is-signed-in control-account" popoverTarget={menuId} onClick={place} title={`${shownName} · ${account}`} aria-label={`${t('account.menu')}: ${shownName}`}>
            <Avatar size={26} />
          </button>
          <div ref={menu} id={menuId} popover="auto" className="account-menu">
            <div className="account-menu-head">
              <Avatar size={40} />
              <div>
                <strong>{shownName}</strong>
                <span>{account}</span>
              </div>
            </div>
            {onAccount && <button type="button" className="account-menu-item" onClick={() => choose(onAccount)}><Icon name="settings" size={18} />{t('account.settings')}</button>}
            <button type="button" className="account-menu-item" onClick={() => choose(() => { void signOut() })}><Icon name="logout" size={18} />{t('auth.sign_out')}</button>
          </div>
        </>
      ) : (
        <button type="button" className="control-button" onClick={() => { window.location.hash = 'signin' }} title={account} aria-label={account}>
          <Icon name="user" />
        </button>
      )}

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
