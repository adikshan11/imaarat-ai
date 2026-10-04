import './App.css'
import { useEffect, useState } from 'react'
import Sidebar from '@/components/layout/Sidebar'
import Dashboard from '@/components/dashboard/Dashboard'
import NewAssessment from '@/components/assessment/NewAssessment'
import BackendAssessmentResult from '@/components/assessment/BackendAssessmentResult'
import AIQuality from '@/components/quality/AIQuality'
import Integrations from '@/components/integrations/Integrations'
import { RiskProvider, useRiskContext } from '@/context/RiskContext'
import type { BackendSubmission } from '@/types/backend'

type View = 'dashboard' | 'new' | 'result' | 'quality' | 'integrations'

function Application() {
  const [view, setViewState] = useState<View>(() => {
    const hash = window.location.hash.slice(1)
    return hash === 'quality' || hash === 'integrations' || hash === 'new' ? hash : 'dashboard'
  })
  const setView = (next: View) => {
    setViewState(next)
    window.history.replaceState(null, '', next === 'dashboard' || next === 'result' ? window.location.pathname : `#${next}`)
  }
  useEffect(() => { window.scrollTo(0, 0) }, [view])
  const [detailError, setDetailError] = useState<string | null>(null)
  const { selectedSubmission, loadDetail, applyReview } = useRiskContext()

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
        {detailError && <div className="error-banner">{detailError}</div>}
        {view === 'dashboard' && <Dashboard onNew={() => setView('new')} onView={(item) => { void showResult(item as BackendSubmission) }} />}
        {view === 'new' && <NewAssessment onCompleted={showResult} onCancel={() => setView('dashboard')} />}
        {view === 'result' && selectedSubmission && <BackendAssessmentResult submission={selectedSubmission} onBack={() => setView('dashboard')} onReviewed={applyReview} />}
        {view === 'quality' && <AIQuality />}
        {view === 'integrations' && <Integrations />}
      </main>
    </div>
  )
}

export default function App() {
  return <RiskProvider><Application /></RiskProvider>
}
