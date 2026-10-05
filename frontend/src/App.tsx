import './App.css'
import { Activity, Suspense, lazy, useEffect, useRef, useState } from 'react'
import Sidebar from '@/components/layout/Sidebar'
import StatusBanner from '@/components/layout/StatusBanner'
import Dashboard from '@/components/dashboard/Dashboard'
import NewAssessment from '@/components/assessment/NewAssessment'
import BackendAssessmentResult from '@/components/assessment/BackendAssessmentResult'

const AIQuality = lazy(() => import('@/components/quality/AIQuality'))
const Integrations = lazy(() => import('@/components/integrations/Integrations'))
const PaperForm = lazy(() => import('@/components/paper/PaperForm'))
const HowItWorks = lazy(() => import('@/components/about/HowItWorks'))
import { RiskProvider, useRiskContext } from '@/context/RiskContext'
import { PreferencesProvider, usePreferences } from '@/context/Preferences'
import type { BackendSubmission } from '@/types/backend'

type View = 'dashboard' | 'new' | 'paper' | 'how' | 'result' | 'quality' | 'integrations'

function Application() {
  const [view, setViewState] = useState<View>(() => {
    const hash = window.location.hash.slice(1)
    return hash === 'quality' || hash === 'integrations' || hash === 'new' || hash === 'paper' || hash === 'how' ? hash : 'dashboard'
  })
  const [draftOpen, setDraftOpen] = useState(view === 'new')
  const [draftId, setDraftId] = useState(0)
  const currentView = useRef(view)
  const [completedSubmission, setCompletedSubmission] = useState<BackendSubmission | null>(null)
  const [resultSubmission, setResultSubmission] = useState<BackendSubmission | null>(null)
  const setView = (next: View) => {
    currentView.current = next
    if (next === 'new') setDraftOpen(true)
    setViewState(next)
    window.history.replaceState(null, '', next === 'dashboard' || next === 'result' ? window.location.pathname : `#${next}`)
  }
  const navigate = (next: View) => {
    if (next === 'new' && !draftOpen && completedSubmission) {
      setResultSubmission(completedSubmission)
      setView('result')
    } else setView(next)
  }
  const startDraft = (values: Record<string, unknown> | null = null) => {
    setCompletedSubmission(null)
    setPrefill(values)
    setDraftId((current) => current + 1)
    setView('new')
  }
  useEffect(() => { window.scrollTo(0, 0) }, [view])
  const [detailError, setDetailError] = useState<string | null>(null)
  const [prefill, setPrefill] = useState<Record<string, unknown> | null>(null)
  const { loadDetail, applyReview } = useRiskContext()
  const { dev } = usePreferences()
  useEffect(() => {
    if (!dev && (view === 'quality' || view === 'integrations')) setView('dashboard')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dev, view])

  const showResult = async (submission: BackendSubmission) => {
    setDetailError(null)
    let result = submission
    if (submission.id) {
      try {
        result = await loadDetail(submission.id)
      } catch (cause) {
        setDetailError(cause instanceof Error ? cause.message : 'Unable to load submission detail')
        return
      }
    }
    setResultSubmission(result)
    setView('result')
  }

  return (
    <div className="app-shell">
      <Sidebar activeView={view === 'result' ? 'new' : view} onNavigate={(next) => navigate(next as View)} />
      <main className="main-content">
        <StatusBanner />
        {detailError && <div className="error-banner">{detailError}</div>}
        {view === 'dashboard' && <Dashboard onNew={() => startDraft()} onView={(item) => { void showResult(item as BackendSubmission) }} />}
        {draftOpen && <Activity mode={view === 'new' ? 'visible' : 'hidden'}><NewAssessment key={draftId} initial={prefill} onCompleted={(result) => {
          setCompletedSubmission(result)
          setDraftOpen(false)
          setPrefill(null)
          if (currentView.current === 'new') {
            setResultSubmission(result)
            setView('result')
          }
        }} onCancel={() => { setDraftOpen(false); setPrefill(null); setView('dashboard') }} /></Activity>}
        <Suspense fallback={<div className="page-loading" aria-busy="true" />}>
        {view === 'how' && <HowItWorks />}
        {view === 'paper' && <PaperForm onUse={startDraft} />}
        {view === 'result' && resultSubmission && <BackendAssessmentResult submission={resultSubmission} onBack={() => setView('dashboard')} onReviewed={(updated) => {
          applyReview(updated)
          setResultSubmission(updated)
          setCompletedSubmission((current) => current?.id === updated.id ? updated : current)
        }} />}
        {view === 'quality' && <AIQuality />}
        {view === 'integrations' && <Integrations />}
        </Suspense>
        <footer className="site-footer">Made with <span className="heart" aria-label="love">♥</span> by <a href="https://adithya-shankaran.vercel.app" target="_blank" rel="noreferrer">Adithya Shankaran</a> · © 2026 imaarat.ai</footer>
      </main>
    </div>
  )
}

export default function App() {
  return <PreferencesProvider><RiskProvider><Application /></RiskProvider></PreferencesProvider>
}
