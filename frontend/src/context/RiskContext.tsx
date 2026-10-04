import React, { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { fetchHistory, fetchSubmissionDetail, submitUnderwriting } from '@/api/underwriting'
import type { BackendHistoryRow, BackendSubmission, SubmissionInput } from '@/types/backend'

interface RiskContextState {
  submissions: BackendHistoryRow[]
  selectedSubmission: BackendSubmission | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  submit: (input: SubmissionInput, images: File[]) => Promise<BackendSubmission>
  loadDetail: (submissionId: number) => Promise<BackendSubmission>
}

const RiskContext = createContext<RiskContextState | undefined>(undefined)

export function RiskProvider({ children }: { children: ReactNode }) {
  const [submissions, setSubmissions] = useState<BackendHistoryRow[]>([])
  const [selectedSubmission, setSelectedSubmission] = useState<BackendSubmission | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = async () => {
    setLoading(true)
    try {
      setSubmissions(await fetchHistory())
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load underwriting history')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [])

  const submit = async (input: SubmissionInput, images: File[]) => {
    const result = await submitUnderwriting(input, images)
    setSubmissions((current) => [result, ...current])
    setSelectedSubmission(result)
    return result
  }

  const loadDetail = async (submissionId: number) => {
    const result = await fetchSubmissionDetail(submissionId)
    setSelectedSubmission(result)
    return result
  }

  return (
    <RiskContext.Provider value={{
      submissions,
      selectedSubmission,
      loading,
      error,
      refresh,
      submit,
      loadDetail,
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
