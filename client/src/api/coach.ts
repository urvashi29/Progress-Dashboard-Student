import { CoachSummarySchema, type CoachSummary } from '@spd/shared'
import { apiRequest } from './client'

export async function fetchCoach(signal?: AbortSignal): Promise<CoachSummary> {
  return apiRequest('/me/coach', CoachSummarySchema, { signal })
}
