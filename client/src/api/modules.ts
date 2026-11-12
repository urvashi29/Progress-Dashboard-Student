import { DashboardModuleSchema, type DashboardModule } from '@spd/shared'
import { z } from 'zod'
import { composeModuleDetail } from '../lib/moduleDetail'
import { ApiError, apiRequest } from './client'
import { ModuleDetailResponseSchema, type ModuleDetailResponse } from './contracts'
import { fetchDashboard } from './dashboard'

const ModuleListPayloadSchema = z.union([
  z.array(DashboardModuleSchema),
  z.object({ modules: z.array(DashboardModuleSchema) }).transform((value) => value.modules),
])

export async function fetchModules(signal?: AbortSignal): Promise<DashboardModule[]> {
  return apiRequest('/me/modules', ModuleListPayloadSchema, { signal })
}

export async function fetchModuleDetail(
  slug: string,
  signal?: AbortSignal,
): Promise<ModuleDetailResponse> {
  try {
    return await apiRequest(
      `/me/modules/${encodeURIComponent(slug)}`,
      ModuleDetailResponseSchema,
      { signal },
    )
  } catch (error) {
    if (!(error instanceof ApiError) || !error.isNotFound) throw error

    const dashboard = await fetchDashboard(signal)
    const composed = composeModuleDetail(dashboard, slug)
    if (!composed) throw error
    return composed
  }
}
