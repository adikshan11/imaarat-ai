import Brand from '@/components/layout/Brand'
import Controls from '@/components/layout/Controls'
import Icon from '@/components/shared/Icon'
import { usePreferences } from '@/context/Preferences'

interface Props {
  activeView: string
  onNavigate: (view: string) => void
}

export default function Sidebar({ activeView, onNavigate }: Props) {
  const { t, dev } = usePreferences()
  const items = [
    { view: 'dashboard', icon: 'grid', text: t('nav.dashboard') },
    { view: 'new', icon: 'plus', text: t('nav.new') },
    { view: 'paper', icon: 'file', text: t('nav.paper') },
    ...(dev ? [
      { view: 'quality', icon: 'gauge', text: t('nav.quality') },
      { view: 'integrations', icon: 'plug', text: t('nav.integrations') },
    ] : []),
  ]
  const link = (item: typeof items[number], className: string) => (
    <button key={item.view} className={`${className} ${activeView === item.view ? 'active' : ''}`} onClick={() => onNavigate(item.view)} aria-current={activeView === item.view ? 'page' : undefined}>
      <Icon name={item.icon} />
      <span>{item.text}</span>
    </button>
  )

  return (
    <>
      <aside className="sidebar">
        <div className="sidebar-inner">
          <Brand sub={t('brand.sub')} />
          <nav className="nav" aria-label={t('nav.section')}>{items.map((item) => link(item, 'nav-item'))}</nav>
          <div className="sidebar-footer">
            <Controls />
            <div className="sidebar-tagline">{t(dev ? 'footer.dev' : 'footer.underwriter')}</div>
          </div>
        </div>
      </aside>

      <header className="topbar">
        <Brand sub={t('brand.sub')} />
        <Controls compact />
      </header>
      <nav className="tabbar" aria-label={t('nav.section')}>{items.map((item) => link(item, 'tab-item'))}</nav>
    </>
  )
}
