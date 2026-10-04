import { usePreferences } from '@/context/Preferences'
import type { Theme } from '@/context/Preferences'

interface Props {
  activeView: string
  onNavigate: (view: string) => void
}

export default function Sidebar({ activeView, onNavigate }: Props) {
  const { t, dev, setDev, theme, setTheme } = usePreferences()
  const item = (view: string, text: string) => (
    <button className={`nav-item ${activeView === view ? 'active' : ''}`} onClick={() => onNavigate(view)}>
      <span>{text}</span>
    </button>
  )

  return (
    <aside className="sidebar">
      <div className="sidebar-inner">
        <div className="brand">
          <div className="brand-logo">I</div>
          <div className="brand-text">
            <div className="brand-title">Imaarat</div>
            <div className="brand-sub">{t('brand.sub')}</div>
          </div>
        </div>

        <div className="sidebar-section-label">{t('nav.section')}</div>
        <nav className="nav">
          {item('dashboard', t('nav.dashboard'))}
          {item('new', t('nav.new'))}
        </nav>

        {dev && <>
          <div className="sidebar-section-label">{t('nav.dev_section')}</div>
          <nav className="nav">
            {item('quality', t('nav.quality'))}
            {item('integrations', t('nav.integrations'))}
          </nav>
        </>}

        <div className="sidebar-footer">
          <label className="sidebar-control">
            <span>{t('theme.label')}</span>
            <select value={theme} onChange={(event) => setTheme(event.target.value as Theme)}>
              {(['system', 'light', 'dark'] as const).map((value) => <option key={value} value={value}>{t(`theme.${value}`)}</option>)}
            </select>
          </label>
          <label className="mode-switch" title={t('mode.dev_hint')}>
            <input type="checkbox" checked={dev} onChange={(event) => setDev(event.target.checked)} />
            <span className="mode-switch-track" aria-hidden="true" />
            <span>{t('mode.dev')}</span>
          </label>
          <div>{t(dev ? 'footer.dev' : 'footer.underwriter')}</div>
        </div>
      </div>
    </aside>
  )
}
