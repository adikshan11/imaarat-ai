import './App.css'
import { Activity, Suspense, lazy, useEffect, useRef, useState } from 'react'
import Sidebar from '@/components/layout/Sidebar'
import StatusBanner from '@/components/layout/StatusBanner'
import Dashboard from '@/components/dashboard/Dashboard'
import { PageSkeleton, TopProgress } from '@/components/shared/Loader'
import NewAssessment from '@/components/assessment/NewAssessment'
import BackendAssessmentResult from '@/components/assessment/BackendAssessmentResult'

const PaperForm = lazy(() => import('@/components/paper/PaperForm'))
const HowItWorks = lazy(() => import('@/components/about/HowItWorks'))
const StatusPage = lazy(() => import('@/components/status/StatusPage'))
const SignIn = lazy(() => import('@/components/auth/SignIn'))
import { useRiskContext } from '@/context/RiskContext'
import { RiskProvider } from '@/context/RiskProvider'
import { useSession } from '@/context/Session'
import { SessionProvider } from '@/context/SessionProvider'
import { usePreferences } from '@/context/Preferences'
import { PreferencesProvider } from '@/context/PreferencesProvider'
import type { BackendSubmission } from '@/types/backend'

type View = 'dashboard' | 'new' | 'paper' | 'how' | 'status' | 'result'

function Application() {
  const [view, setViewState] = useState<View>(() => {
    const hash = window.location.hash.slice(1)
    if (hash === 'quality' || hash === 'integrations') return 'status'
    return hash === 'new' || hash === 'paper' || hash === 'how' || hash === 'status' ? hash : 'dashboard'
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
  const [opening, setOpening] = useState(false)
  const [prefill, setPrefill] = useState<Record<string, unknown> | null>(null)
  const { loadDetail, applyReview } = useRiskContext()
  const { t } = usePreferences()

  const showResult = async (submission: BackendSubmission) => {
    setDetailError(null)
    let result = submission
    if (submission.id) {
      setOpening(true)
      try {
        result = await loadDetail(submission.id)
      } catch (cause) {
        setDetailError(cause instanceof Error ? cause.message : 'Unable to load submission detail')
        return
      } finally {
        setOpening(false)
      }
    }
    setResultSubmission(result)
    setView('result')
  }

  return (
    <div className="app-shell">
      <Sidebar activeView={view === 'result' ? 'new' : view} onNavigate={(next) => navigate(next as View)} />
      <main className="main-content">
        {opening && <TopProgress />}
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
        <Suspense fallback={<PageSkeleton />}>
        {view === 'how' && <HowItWorks />}
        {view === 'status' && <StatusPage />}
        {view === 'paper' && <PaperForm onUse={startDraft} />}
        {view === 'result' && resultSubmission && <BackendAssessmentResult submission={resultSubmission} onBack={() => setView('dashboard')} onReviewed={(updated) => {
          applyReview(updated)
          setResultSubmission(updated)
          setCompletedSubmission((current) => current?.id === updated.id ? updated : current)
        }} />}
        </Suspense>
        <footer className="site-footer">Made with <span className="heart" aria-label="love">♥</span> by <a href="https://adithya-shankaran.vercel.app" target="_blank" rel="noreferrer">Adithya Shankaran</a> · © 2026 imaarat.ai · <a href="#status" onClick={(event) => { event.preventDefault(); setView('status') }}>{t('nav.status')}</a> · <span lang="en"><a href="/changelog/">Changelog</a> · <a href="/privacy/">Privacy Policy</a> · <a href="/terms/">Terms of Service</a></span></footer>
      </main>
    </div>
  )
}

const DEMO_KEY = 'imaarat.demo'

function Gate() {
  const { session, ready } = useSession()
  const [demo, setDemo] = useState(() => {
    if (new URLSearchParams(window.location.search).has('demo')) {
      sessionStorage.setItem(DEMO_KEY, '1')
      window.history.replaceState(null, '', window.location.pathname + window.location.hash)
    }
    return sessionStorage.getItem(DEMO_KEY) === '1'
  })
  const [asked, setAsked] = useState(() => window.location.hash === '#signin')
  useEffect(() => {
    const follow = () => setAsked(window.location.hash === '#signin')
    window.addEventListener('hashchange', follow)
    return () => window.removeEventListener('hashchange', follow)
  }, [])
  if (!ready) return <PageSkeleton />
  if (!session && (!demo || asked)) {
    return <Suspense fallback={<PageSkeleton />}><SignIn onDemo={() => {
      sessionStorage.setItem(DEMO_KEY, '1')
      if (window.location.hash === '#signin') window.history.replaceState(null, '', window.location.pathname)
      setAsked(false)
      setDemo(true)
    }} /></Suspense>
  }
  return <Application />
}

export default function App() {
  return <PreferencesProvider><SessionProvider><RiskProvider><Gate /></RiskProvider></SessionProvider></PreferencesProvider>
}
