import {
  CATALOG_NOTE,
  getModuleBySlug,
  type DashboardModule,
  type Enrollment,
  type ModuleProgressRecord,
} from '@spd/shared'
import {
  ModuleDetailResponseSchema,
  ModuleListResponseSchema,
  type ModuleDetailResponse,
  type ModuleListResponse,
} from '../contracts/module-views'
import { buildDashboardModules } from './dashboard'

export interface ModuleCatalogInput {
  enrollment: Enrollment
  moduleProgress: readonly ModuleProgressRecord[]
  now: Date
  timeZone?: string
}

export function buildModuleList(input: ModuleCatalogInput): ModuleListResponse {
  return ModuleListResponseSchema.parse({
    modules: buildDashboardModules(input),
    generatedAt: input.now.toISOString(),
  })
}

/**
 * Returns null when the slug is not part of the approved catalog. Progress for
 * a catalog module that is absent from the plan is still returned, labelled
 * NOT_IN_PLAN rather than a fabricated 0%-started module.
 */
export function buildModuleDetail(
  input: ModuleCatalogInput,
  slug: string,
): ModuleDetailResponse | null {
  const catalogModule = getModuleBySlug(slug)
  if (!catalogModule) return null

  const modules = buildDashboardModules(input)
  const module = modules.find((entry) => entry.moduleSlug === slug)
  if (!module) return null

  const prerequisites = catalogModule.prerequisiteModuleSlugs
    .map((prerequisiteSlug) =>
      modules.find((entry) => entry.moduleSlug === prerequisiteSlug),
    )
    .filter((entry): entry is DashboardModule => entry !== undefined)
    .sort((a, b) => a.catalogOrder - b.catalogOrder)

  const activities = catalogModule.skills.flatMap((skill) =>
    skill.activityTemplates.map((activity) => ({
      ...activity,
      skill: skill.name,
    })),
  )

  return ModuleDetailResponseSchema.parse({
    module,
    skills: catalogModule.skills,
    activities,
    prerequisites,
    minutesPerProgressPoint: catalogModule.minutesPerProgressPoint,
    skillsAreEstimated: true,
    caveat: CATALOG_NOTE,
    generatedAt: input.now.toISOString(),
  })
}
