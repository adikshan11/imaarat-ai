import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { fetchDashboard, fetchHistoryPage, fetchStatus, fetchSubmissionDetail, submitUnderwriting } from '@/api/underwriting'
import type { BackendHistoryRow, BackendSubmission, DeploymentStatus, HistoryQuery, PortfolioSummary, SubmissionInput } from '@/types/backend'

const PAGE_SIZE = 20

interface RiskContextState {
  portfolio: PortfolioSummary | null
  rows: BackendHistoryRow[]
  total: number
  query: HistoryQuery
  setQuery: (update: Partial<HistoryQuery>) => void
  selectedSubmission: BackendSubmission | null
  loading: boolean
  error: string | null
  status: DeploymentStatus | null
  refresh: () => void
  submit: (input: SubmissionInput, images: File[]) => Promise<BackendSubmission>
  loadDetail: (submissionId: number) => Promise<BackendSubmission>
  applyReview: (updated: BackendSubmission) => void
}

const RiskContext = createContext<RiskContextState | undefined>(undefined)

export function RiskProvider({ children }: { children: ReactNode }) {
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null)
  const [rows, setRows] = useState<BackendHistoryRow[]>([])
  const [total, setTotal] = useState(0)
  const [query, setQueryState] = useState<HistoryQuery>({ limit: PAGE_SIZE, offset: 0, decision: 'All', q: '', sort: 'created', direction: 'desc' })
  const [version, setVersion] = useState(0)
  const loadedVersion = useRef(-1)
  const [selectedSubmission, setSelectedSubmission] = useState<BackendSubmission | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<DeploymentStatus | null>(null)

  const setQuery = useCallback((update: Partial<HistoryQuery>) => setQueryState((current) => ({ ...current, offset: 0, ...update })), [])
  const refresh = useCallback(() => setVersion((current) => current + 1), [])

  useEffect(() => {
    fetchStatus().then(setStatus).catch(() => setStatus(null))
  }, [])

  useEffect(() => {
    let current = true
    const withTotals = loadedVersion.current !== version
    const request = withTotals
      ? fetchDashboard(query).then(({ portfolio: totals, history }) => {
        if (current) setPortfolio(totals)
        return history
      })
      : fetchHistoryPage(query)
    request
      .then((page) => {
        if (!current) return
        loadedVersion.current = version
        setRows(page.rows)
        setTotal(page.total)
        setError(null)
      })
      .catch((cause) => { if (current) setError(cause instanceof Error ? cause.message : 'Unable to load underwriting history') })
      .finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [query, version])

  const submit = async (input: SubmissionInput, images: File[]) => {
    const result = await submitUnderwriting(input, images)
    setSelectedSubmission(result)
    refresh()
    return result
  }

  const loadDetail = async (submissionId: number) => {
    const result = await fetchSubmissionDetail(submissionId)
    setSelectedSubmission(result)
    return result
  }

  const applyReview = (updated: BackendSubmission) => {
    setSelectedSubmission(updated)
    setRows((current) => current.map((item) => (item.id === updated.id ? { ...item, review_status: updated.review_status, final_decision: updated.final_decision } : item)))
    refresh()
  }

  return (
    <RiskContext.Provider value={{
      portfolio,
      rows,
      total,
      query,
      setQuery,
      selectedSubmission,
      loading,
      error,
      status,
      refresh,
      submit,
      loadDetail,
      applyReview,
    }}>
      {children}
    </RiskContext.Provider>
  )
}

export function useRiskContext() {
  const value = useContext(RiskContext)
  if (!value) throw new Error('useRiskContext must be used inside RiskProvider')
  return value
}
