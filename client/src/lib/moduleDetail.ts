import {
  CATALOG_NOTE,
  getModuleBySlug,
  type ActivityTemplate,
  type DashboardResponse,
} from '@spd/shared'
import { ModuleDetailResponseSchema, type ModuleDetailResponse } from '../api/contracts'

export function composeModuleDetail(
  dashboard: DashboardResponse,
  slug: string,
): ModuleDetailResponse | null {
  const module = dashboard.modules.find((entry) => entry.moduleSlug === slug)
  if (!module) return null

  const catalog = getModuleBySlug(slug)
  if (!catalog) return null

  const progressBySlug = new Map(
    dashboard.modules.map((entry) => [entry.moduleSlug, entry]),
  )

  const prerequisites = catalog.prerequisiteModuleSlugs.map((prerequisiteSlug) => {
    const progress = progressBySlug.get(prerequisiteSlug)
    const prerequisiteCatalog = getModuleBySlug(prerequisiteSlug)
    return {
      moduleSlug: prerequisiteSlug,
      name: prerequisiteCatalog?.name ?? progress?.name ?? prerequisiteSlug,
      progressPct: progress?.inPlan ? progress.progressPct : null,
      inPlan: progress?.inPlan ?? false,
      band: progress?.band ?? null,
    }
  })

  const suggestedActivities: ActivityTemplate[] = []
  const seenTitles = new Set<string>()
  for (const skill of catalog.skills) {
    for (const activity of skill.activityTemplates) {
      if (seenTitles.has(activity.title)) continue
      seenTitles.add(activity.title)
      suggestedActivities.push(activity)
    }
  }

  return ModuleDetailResponseSchema.parse({
    module,
    catalog,
    prerequisites,
    suggestedActivities: suggestedActivities.slice(0, 6),
    skillsAreEstimated: true,
    confidence: 'low',
    caveat: CATALOG_NOTE,
  })
}
