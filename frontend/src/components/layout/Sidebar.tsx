import React from 'react'

interface Props {
  activeView: string
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
          <button className={`nav-item ${activeView === 'quality' ? 'active' : ''}`} onClick={() => onNavigate('quality')}>
            <span>AI Quality</span>
          </button>
          <button className={`nav-item ${activeView === 'integrations' ? 'active' : ''}`} onClick={() => onNavigate('integrations')}>
            <span>MCP &amp; A2A</span>
          </button>
        </nav>

        <div className="sidebar-footer">Python decides · Gemini explains · LangGraph orchestrates</div>
      </div>
    </aside>
  )
}

export default Sidebar
