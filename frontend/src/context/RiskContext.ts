import { createContext, useContext } from 'react'
import type { BackendHistoryRow, BackendSubmission, DeploymentStatus, HistoryQuery, PortfolioSummary, SubmissionInput } from '@/types/backend'

export interface RiskContextState {
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

export const RiskContext = createContext<RiskContextState | undefined>(undefined)

export function useRiskContext() {
  const value = useContext(RiskContext)
  if (!value) throw new Error('useRiskContext must be used inside RiskProvider')
  return value
}
