import { useRef } from 'react'
import Icon from '@/components/shared/Icon'
import { usePreferences } from '@/context/Preferences'
import { LANGUAGES } from '@/i18n/languages'

export default function Controls({ compact = false }: { compact?: boolean }) {
  const { t, language, setLanguage, dark, toggleTheme, dev, setDev } = usePreferences()
  const dialog = useRef<HTMLDialogElement>(null)
  const themeLabel = `${t('theme.label')}: ${t(dark ? 'theme.light' : 'theme.dark')}`

  return (
    <div className={compact ? 'controls controls-compact' : 'controls'}>
      <button type="button" className="control-button control-language" onClick={() => dialog.current?.showModal()} title={t('lang.label')} aria-label={`${t('lang.label')}: ${language.english}`}>
        <Icon name="globe" />
        <span lang={language.code}>{language.name}</span>
      </button>
      <button type="button" className="control-button" onClick={toggleTheme} title={themeLabel} aria-label={themeLabel}>
        <Icon name={dark ? 'sun' : 'moon'} />
      </button>
      {dev && (
        <button type="button" className="control-button is-on" onClick={() => setDev(false)} title={t('mode.dev')} aria-label={t('mode.dev')}>
          <Icon name="code" />
          {!compact && <Icon name="close" size={14} />}
        </button>
      )}

      <dialog ref={dialog} className="language-dialog" aria-label={t('lang.label')} onClick={(event) => { if (event.target === dialog.current) dialog.current?.close() }}>
        <div className="language-dialog-head">
          <strong>{t('lang.label')}</strong>
          <button type="button" className="control-button" onClick={() => dialog.current?.close()} aria-label={t('new.cancel')}><Icon name="close" /></button>
        </div>
        <div className="language-grid">
          {LANGUAGES.map((item) => (
            <button
              type="button"
              key={item.code}
              className={item.code === language.code ? 'language-option is-current' : 'language-option'}
              onClick={() => { setLanguage(item.code); dialog.current?.close() }}
            >
              <span lang={item.code} className="language-native">{item.name}</span>
              <span className="language-english">{item.english}{item.draft ? ' · draft' : ''}</span>
            </button>
          ))}
        </div>
        <p className="card-footnote">{t('lang.machine')}</p>
      </dialog>
    </div>
  )
}
