import React from 'react'

interface Props {
  activeView: 'dashboard' | 'new' | 'assessment' | 'underwriting'
  onNavigate: (view: string) => void
}

const Sidebar: React.FC<Props> = ({ activeView, onNavigate }) => {
  return (
    <aside className="sidebar">
      <div className="sidebar-inner">
        <div className="brand">
          <div className="brand-logo">P</div>
          <div className="brand-text">
            <div className="brand-title">Property Risk Assesment</div>
            <div className="brand-sub">Underwriting Intelligence</div>
          </div>
        </div>

        <div className="sidebar-section-label">Navigation</div>
        <nav className="nav">
          <button className={`nav-item ${activeView === 'dashboard' ? 'active' : ''}`} onClick={() => onNavigate('dashboard')}>
            <span>Dashboard</span>
          </button>
          <button className={`nav-item ${activeView === 'new' ? 'active' : ''}`} onClick={() => onNavigate('new')}>
            <span>New Assessment</span>
          </button>
        </nav>

        <div className="sidebar-footer">Portfolio scoring model v4.2 · CAT tables updated quarterly</div>
      </div>
    </aside>
  )
}

export default Sidebar
