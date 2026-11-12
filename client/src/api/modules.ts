import {
  DashboardModuleSchema,
  getModuleBySlug,
  type ActivityTemplate,
  type DashboardModule,
} from '@spd/shared'
import { z } from 'zod'
import { composeModuleDetail } from '../lib/moduleDetail'
import { ApiError, apiRequest } from './client'
import {
  ModuleDetailResponseSchema,
  ServerModuleDetailSchema,
  type ModuleDetailResponse,
  type ServerModuleDetail,
} from './contracts'
import { fetchDashboard } from './dashboard'

const ModuleListPayloadSchema = z.union([
  z.array(DashboardModuleSchema),
  z.object({ modules: z.array(DashboardModuleSchema) }).transform((value) => value.modules),
])

export async function fetchModules(signal?: AbortSignal): Promise<DashboardModule[]> {
  return apiRequest('/me/modules', ModuleListPayloadSchema, { signal })
}

/**
 * Adapts the backend wire contract to the UI view model. The backend owns the
 * authoritative module, skills and activities; the catalog lookup supplies the
 * curated ordering/skills content the page renders.
 */
function toModuleDetail(payload: ServerModuleDetail): ModuleDetailResponse {
  const catalog = getModuleBySlug(payload.module.moduleSlug)
  if (!catalog) {
    throw new ApiError('The server returned an unknown module.', 200, 'invalid_response')
  }

  const prerequisites = payload.prerequisites.map((entry) => ({
    moduleSlug: entry.moduleSlug,
    name: entry.name,
    progressPct: entry.inPlan ? entry.progressPct : null,
    inPlan: entry.inPlan,
    band: entry.band,
  }))

  const seenTitles = new Set<string>()
  const suggestedActivities: ActivityTemplate[] = []
  for (const activity of payload.activities) {
    if (seenTitles.has(activity.title)) continue
    seenTitles.add(activity.title)
    suggestedActivities.push({
      title: activity.title,
      type: activity.type,
      minutes: activity.minutes,
    })
  }

  return ModuleDetailResponseSchema.parse({
    module: payload.module,
    catalog,
    prerequisites,
    suggestedActivities: suggestedActivities.slice(0, 6),
    skillsAreEstimated: payload.skillsAreEstimated,
    confidence: 'low',
    caveat: payload.caveat,
  })
}

export async function fetchModuleDetail(
  slug: string,
  signal?: AbortSignal,
): Promise<ModuleDetailResponse> {
  try {
    const payload = await apiRequest(
      `/me/modules/${encodeURIComponent(slug)}`,
      ServerModuleDetailSchema,
      { signal },
    )
    return toModuleDetail(payload)
  } catch (error) {
    if (!(error instanceof ApiError) || !error.isNotFound) throw error

    const dashboard = await fetchDashboard(signal)
    const composed = composeModuleDetail(dashboard, slug)
    if (!composed) throw error
    return composed
  }
}
