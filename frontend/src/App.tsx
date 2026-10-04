import './App.css'
import { useState } from 'react'
import Sidebar from '@/components/layout/Sidebar'
import Dashboard from '@/components/dashboard/Dashboard'
import NewAssessment from '@/components/assessment/NewAssessment'
import BackendAssessmentResult from '@/components/assessment/BackendAssessmentResult'
import { RiskProvider, useRiskContext } from '@/context/RiskContext'
import type { BackendSubmission } from '@/types/backend'

type View = 'dashboard' | 'new' | 'result'

function Application() {
  const [view, setView] = useState<View>('dashboard')
  const [detailError, setDetailError] = useState<string | null>(null)
  const { selectedSubmission, loadDetail } = useRiskContext()

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
      <Sidebar activeView={view === 'result' ? 'assessment' : view} onNavigate={(next) => setView(next === 'new' ? 'new' : 'dashboard')} />
      <main className="main-content">
        {detailError && <div className="error-banner">{detailError}</div>}
        {view === 'dashboard' && <Dashboard onNew={() => setView('new')} onView={(item) => { void showResult(item as BackendSubmission) }} />}
        {view === 'new' && <NewAssessment onCompleted={showResult} onCancel={() => setView('dashboard')} />}
        {view === 'result' && selectedSubmission && <BackendAssessmentResult submission={selectedSubmission} onBack={() => setView('dashboard')} />}
      </main>
    </div>
  )
}

export default function App() {
  return <RiskProvider><Application /></RiskProvider>
}
