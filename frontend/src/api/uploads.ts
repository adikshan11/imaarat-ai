import { useEffect, useState } from 'react'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

export type ImageKind = 'profile_photo' | 'form_photo' | 'property_photo'
export type UploadLimits = Record<ImageKind, number> & { types: string[]; max_pixels: number }

let pending: Promise<UploadLimits | null> | null = null

export function uploadLimits(): Promise<UploadLimits | null> {
  pending ??= fetch(`${API_BASE_URL}/uploads/limits`).then((response) => (response.ok ? response.json() : null)).catch(() => null)
  return pending
}

export function useUploadLimits(): UploadLimits | null {
  const [limits, setLimits] = useState<UploadLimits | null>(null)
  useEffect(() => { void uploadLimits().then(setLimits) }, [])
  return limits
}

export function imageProblem(file: File, kind: ImageKind, limits: UploadLimits | null): 'type' | 'size' | null {
  if (!limits) return null
  if (!limits.types.includes(file.type)) return 'type'
  return file.size > limits[kind] ? 'size' : null
}
