import { CATALOG_NOTE, MOCK_DASHBOARD, getModuleBySlug } from '@spd/shared'
import { ServerModuleDetailSchema, type ServerModuleDetail } from '../api/contracts'

/**
 * Builds the same wire shape the Express API returns, so isolated frontend
 * tests exercise the real response mapping rather than a hand-copied shape.
 */
export function buildModuleDetail(slug: string): ServerModuleDetail | null {
  const module = MOCK_DASHBOARD.modules.find((entry) => entry.moduleSlug === slug)
  const catalog = getModuleBySlug(slug)
  if (!module || !catalog) return null

  const bySlug = new Map(MOCK_DASHBOARD.modules.map((entry) => [entry.moduleSlug, entry]))
  const prerequisites = catalog.prerequisiteModuleSlugs
    .map((prerequisiteSlug) => bySlug.get(prerequisiteSlug))
    .filter((entry): entry is NonNullable<typeof entry> => entry !== undefined)
    .sort((a, b) => a.catalogOrder - b.catalogOrder)

  const activities = catalog.skills.flatMap((skill) =>
    skill.activityTemplates.map((activity) => ({ ...activity, skill: skill.name })),
  )

  return ServerModuleDetailSchema.parse({
    module,
    skills: catalog.skills,
    activities,
    prerequisites,
    minutesPerProgressPoint: catalog.minutesPerProgressPoint,
    skillsAreEstimated: true,
    caveat: CATALOG_NOTE,
    generatedAt: MOCK_DASHBOARD.generatedAt,
  })
}
