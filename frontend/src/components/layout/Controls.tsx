import { useRef } from 'react'
import Icon from '@/components/shared/Icon'
import { usePreferences } from '@/context/Preferences'
import type { Theme } from '@/context/Preferences'
import { LANGUAGES } from '@/i18n/languages'

const NEXT_THEME: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' }
const THEME_ICON: Record<Theme, string> = { system: 'monitor', light: 'sun', dark: 'moon' }

export default function Controls({ compact = false }: { compact?: boolean }) {
  const { t, language, setLanguage, theme, setTheme, dev, setDev } = usePreferences()
  const dialog = useRef<HTMLDialogElement>(null)
  const themeLabel = `${t('theme.label')}: ${t(`theme.${theme}`)}`

  return (
    <div className={compact ? 'controls controls-compact' : 'controls'}>
      <button type="button" className="control-button control-language" onClick={() => dialog.current?.showModal()} title={t('lang.label')} aria-label={`${t('lang.label')}: ${language.english}`}>
        <Icon name="globe" />
        <span lang={language.code}>{language.name}</span>
      </button>
      <button type="button" className="control-button" onClick={() => setTheme(NEXT_THEME[theme])} title={themeLabel} aria-label={themeLabel}>
        <Icon name={THEME_ICON[theme]} />
      </button>
      <button type="button" className={dev ? 'control-button is-on' : 'control-button'} onClick={() => setDev(!dev)} title={t('mode.dev_hint')} aria-label={t('mode.dev')} aria-pressed={dev}>
        <Icon name="code" />
      </button>

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
