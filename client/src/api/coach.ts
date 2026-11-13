import {
  CoachAskResponseSchema,
  CoachModuleGuideSchema,
  CoachSummarySchema,
  type CoachAskResponse,
  type CoachModuleGuide,
  type CoachSummary,
} from '@spd/shared'
import { apiRequest } from './client'

export async function fetchCoach(signal?: AbortSignal): Promise<CoachSummary> {
  return apiRequest('/me/coach', CoachSummarySchema, { signal })
}

export async function fetchModuleGuide(
  moduleSlug: string,
  signal?: AbortSignal,
): Promise<CoachModuleGuide> {
  return apiRequest(
    `/me/coach/modules/${encodeURIComponent(moduleSlug)}/guide`,
    CoachModuleGuideSchema,
    { method: 'POST', body: {}, signal },
  )
}

export async function askCoach(
  question: string,
  moduleSlug?: string,
  signal?: AbortSignal,
): Promise<CoachAskResponse> {
  return apiRequest('/me/coach/ask', CoachAskResponseSchema, {
    method: 'POST',
    body: { question, ...(moduleSlug ? { moduleSlug } : {}) },
    signal,
  })
}
