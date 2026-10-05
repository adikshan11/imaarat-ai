import './App.css'
import { useEffect, useState } from 'react'
import Sidebar from '@/components/layout/Sidebar'
import StatusBanner from '@/components/layout/StatusBanner'
import Dashboard from '@/components/dashboard/Dashboard'
import NewAssessment from '@/components/assessment/NewAssessment'
import BackendAssessmentResult from '@/components/assessment/BackendAssessmentResult'
import AIQuality from '@/components/quality/AIQuality'
import Integrations from '@/components/integrations/Integrations'
import PaperForm from '@/components/paper/PaperForm'
import { RiskProvider, useRiskContext } from '@/context/RiskContext'
import { PreferencesProvider, usePreferences } from '@/context/Preferences'
import { SessionProvider } from '@/context/SessionContext'
import type { BackendSubmission } from '@/types/backend'

type View = 'dashboard' | 'new' | 'paper' | 'result' | 'quality' | 'integrations'

function Application() {
  const [view, setViewState] = useState<View>(() => {
    const hash = window.location.hash.slice(1)
    return hash === 'quality' || hash === 'integrations' || hash === 'new' || hash === 'paper' ? hash : 'dashboard'
  })
  const setView = (next: View) => {
    setViewState(next)
    window.history.replaceState(null, '', next === 'dashboard' || next === 'result' ? window.location.pathname : `#${next}`)
  }
  useEffect(() => { window.scrollTo(0, 0) }, [view])
  const [detailError, setDetailError] = useState<string | null>(null)
  const [prefill, setPrefill] = useState<Record<string, unknown> | null>(null)
  const { selectedSubmission, loadDetail, applyReview } = useRiskContext()
  const { dev } = usePreferences()
  useEffect(() => {
    if (!dev && (view === 'quality' || view === 'integrations')) setView('dashboard')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dev, view])

  const showResult = async (submission: BackendSubmission) => {
    setDetailError(null)
    if (submission.id) {
      try {
        await loadDetail(submission.id)
      } catch (cause) {
        setDetailError(cause instanceof Error ? cause.message : 'Unable to load submission detail')
        return
      }
    }
    setView('result')
  }

  return (
    <div className="app-shell">
      <Sidebar activeView={view === 'result' ? 'assessment' : view} onNavigate={(next) => setView(next as View)} />
      <main className="main-content">
        <StatusBanner />
        {detailError && <div className="error-banner">{detailError}</div>}
        {view === 'dashboard' && <Dashboard onNew={() => setView('new')} onView={(item) => { void showResult(item as BackendSubmission) }} />}
        {view === 'new' && <NewAssessment key={prefill ? 'paper' : 'blank'} initial={prefill} onCompleted={(result) => { setPrefill(null); void showResult(result) }} onCancel={() => { setPrefill(null); setView('dashboard') }} />}
        {view === 'paper' && <PaperForm onUse={(values) => { setPrefill(values); setView('new') }} />}
        {view === 'result' && selectedSubmission && <BackendAssessmentResult submission={selectedSubmission} onBack={() => setView('dashboard')} onReviewed={applyReview} />}
        {view === 'quality' && <AIQuality />}
        {view === 'integrations' && <Integrations />}
        <footer className="site-footer">Made with <span className="heart" aria-label="love">♥</span> by <a href="https://adithya-shankaran.vercel.app" target="_blank" rel="noreferrer">Adithya Shankaran</a> · © 2026 imaarat.ai</footer>
      </main>
    </div>
  )
}

export default function App() {
  return <PreferencesProvider><SessionProvider><RiskProvider><Application /></RiskProvider></SessionProvider></PreferencesProvider>
}
