import { DashboardResponseSchema, type DashboardResponse } from '@spd/shared'
import { apiRequest } from './client'

export async function fetchDashboard(signal?: AbortSignal): Promise<DashboardResponse> {
  return apiRequest('/me/dashboard', DashboardResponseSchema, { signal })
}
