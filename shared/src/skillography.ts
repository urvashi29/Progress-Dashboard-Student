import { z } from 'zod'
import {
  ConfidenceSchema,
  IsoDateSchema,
  IsoDateTimeSchema,
  PercentSchema,
  SlugSchema,
  TrackSlugSchema,
} from './common'
import { EnrollmentSchema } from './enrollments'
import {
  ActivityTemplateSchema,
  ModuleProgressBandSchema,
  SkillImportanceSchema,
  type CatalogModule,
} from './modules'
import { MODULES } from './catalog'
import { StudentProfileSchema } from './students'

export const SKILLOGRAPHY_METHODOLOGY =
  'Estimated exposure is the progress-weighted average of in-plan modules associated with a skill. ' +
  'Only in-plan modules are counted; a skill whose modules are all outside the plan has no exposure estimate. ' +
  'This is curriculum coverage, not measured proficiency.'

export const SKILLOGRAPHY_LIMITATIONS: readonly string[] = [
  'Skill exposure is inferred from module completion and is never a verified proficiency score.',
  'No assessment or portfolio evidence is collected, so confidence stays low.',
  'A completed module does not by itself qualify anyone for a job or professional role.',
  'The curated module-to-skill mapping is a curriculum inference pending review against learning materials.',
]

export const SkillStatusSchema = z.enum([
  'STRONG_EXPOSURE',
  'IN_PROGRESS',
  'NOT_STARTED',
  'NOT_IN_PLAN',
  'UNAVAILABLE',
])

export const SkillCatalogModuleAssociationSchema = z.object({
  moduleSlug: SlugSchema,
  moduleName: z.string().min(1),
  track: TrackSlugSchema,
  weight: z.number().finite().min(0).max(1),
  importance: SkillImportanceSchema,
})

export const SkillCatalogEntrySchema = z.object({
  id: SlugSchema,
  name: z.string().min(1),
  normalizedName: z.string().min(1),
  description: z.string().min(1),
  importance: SkillImportanceSchema,
  /** Largest association weight, shown as an indicative catalog weight. */
  weight: z.number().finite().min(0).max(1),
  moduleAssociations: z.array(SkillCatalogModuleAssociationSchema).min(1),
  prerequisiteSkillIds: z.array(SlugSchema),
  practiceActivities: z.array(ActivityTemplateSchema),
  portfolioEvidence: z.array(z.string().min(1)),
  estimated: z.literal(true),
  confidence: ConfidenceSchema,
})

export const SkillExposureModuleSchema = z.object({
  moduleSlug: SlugSchema,
  moduleName: z.string().min(1),
  track: TrackSlugSchema,
  weight: z.number().finite().min(0).max(1),
  importance: SkillImportanceSchema,
  inPlan: z.boolean(),
  /** False when a progress record exists but its value is not usable. */
  progressAvailable: z.boolean(),
  /** Null when the module is not in the plan or its progress is unavailable. */
  progressPct: PercentSchema.nullable(),
  contributionPct: z.number().finite().min(0).max(100),
})

export const SkillEvidenceSourceSchema = z.object({
  type: z.literal('module_progress'),
  moduleSlug: SlugSchema,
  moduleName: z.string().min(1),
  progressPct: PercentSchema,
  weight: z.number().finite().min(0).max(1),
  contributionPct: z.number().finite().min(0).max(100),
  updatedAt: IsoDateSchema,
})

export const SkillExposureSchema = z.object({
  skillId: SlugSchema,
  name: z.string().min(1),
  normalizedName: z.string().min(1),
  description: z.string().min(1),
  importance: SkillImportanceSchema,
  estimatedExposurePct: PercentSchema.nullable(),
  status: SkillStatusSchema,
  confidence: ConfidenceSchema,
  confidenceLabel: z.string().min(1),
  limitation: z.string().min(1),
  requiresPractice: z.boolean(),
  moduleAssociations: z.array(SkillExposureModuleSchema),
  evidenceSources: z.array(SkillEvidenceSourceSchema),
  prerequisiteSkillIds: z.array(SlugSchema),
  practiceActivities: z.array(ActivityTemplateSchema),
  portfolioEvidence: z.array(z.string().min(1)),
})

export const SkillPracticeAreaSchema = z.object({
  skillId: SlugSchema,
  name: z.string().min(1),
  importance: SkillImportanceSchema,
  status: SkillStatusSchema,
  estimatedExposurePct: PercentSchema.nullable(),
  reason: z.string().min(1),
  practiceActivities: z.array(ActivityTemplateSchema),
  portfolioEvidence: z.array(z.string().min(1)),
})

export const SkillographyTrackSchema = z.object({
  track: TrackSlugSchema,
  name: z.string().min(1),
  skillIds: z.array(SlugSchema),
  skillCount: z.number().int().nonnegative(),
  inPlanSkillCount: z.number().int().nonnegative(),
  averageExposurePct: PercentSchema.nullable(),
})

export const ModuleSkillLinkSchema = z.object({
  skillId: SlugSchema,
  name: z.string().min(1),
  weight: z.number().finite().min(0).max(1),
  importance: SkillImportanceSchema,
})

export const ModuleSkillMappingSchema = z.object({
  moduleSlug: SlugSchema,
  name: z.string().min(1),
  track: TrackSlugSchema,
  catalogOrder: z.number().int().positive(),
  inPlan: z.boolean(),
  progressPct: PercentSchema,
  band: ModuleProgressBandSchema,
  skills: z.array(ModuleSkillLinkSchema),
})

export const SkillListResponseSchema = z.object({
  skills: z.array(SkillExposureSchema),
  practiceAreas: z.array(SkillPracticeAreaSchema),
  methodology: z.string().min(1),
  limitations: z.array(z.string().min(1)),
  skillsAreEstimated: z.literal(true),
  proficiencyAvailable: z.literal(false),
  generatedAt: IsoDateTimeSchema,
})

export const SkillographyResponseSchema = SkillListResponseSchema.extend({
  student: StudentProfileSchema,
  enrollment: EnrollmentSchema,
  tracks: z.array(SkillographyTrackSchema),
  modules: z.array(ModuleSkillMappingSchema),
})

const IMPORTANCE_RANK: Record<z.infer<typeof SkillImportanceSchema>, number> = {
  supporting: 1,
  core: 2,
  critical: 3,
}

function dedupeActivities(
  activities: readonly z.infer<typeof ActivityTemplateSchema>[],
): z.infer<typeof ActivityTemplateSchema>[] {
  const seen = new Set<string>()
  const result: z.infer<typeof ActivityTemplateSchema>[] = []
  for (const activity of activities) {
    const key = `${activity.type}:${activity.title}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push({ ...activity })
  }
  return result
}

function dedupeStrings(values: readonly string[]): string[] {
  return [...new Set(values)]
}

/**
 * Builds the central skill catalog from the curated module mapping. Repeating a
 * skill across modules merges its associations instead of creating a duplicate
 * skill with a slightly different name.
 */
export function buildSkillCatalog(
  modules: readonly CatalogModule[] = MODULES,
): z.infer<typeof SkillCatalogEntrySchema>[] {
  const byId = new Map<string, z.infer<typeof SkillCatalogEntrySchema>>()

  for (const catalogModule of modules) {
    for (const skill of catalogModule.skills) {
      const existing = byId.get(skill.id)
      const association = {
        moduleSlug: catalogModule.slug,
        moduleName: catalogModule.name,
        track: catalogModule.track,
        weight: skill.weight,
        importance: skill.importance,
      }

      if (!existing) {
        byId.set(skill.id, {
          id: skill.id,
          name: skill.name,
          normalizedName: skill.normalizedName,
          description: skill.description,
          importance: skill.importance,
          weight: skill.weight,
          moduleAssociations: [association],
          prerequisiteSkillIds: dedupeStrings(skill.prereqSkillIds),
          practiceActivities: dedupeActivities(skill.activityTemplates),
          portfolioEvidence: dedupeStrings(skill.portfolioEvidence),
          estimated: true,
          confidence: 'low',
        })
        continue
      }

      if (!existing.moduleAssociations.some((entry) => entry.moduleSlug === catalogModule.slug)) {
        existing.moduleAssociations.push(association)
      }
      if (IMPORTANCE_RANK[skill.importance] > IMPORTANCE_RANK[existing.importance]) {
        existing.importance = skill.importance
      }
      existing.weight = Math.max(existing.weight, skill.weight)
      existing.prerequisiteSkillIds = dedupeStrings([
        ...existing.prerequisiteSkillIds,
        ...skill.prereqSkillIds,
      ])
      existing.practiceActivities = dedupeActivities([
        ...existing.practiceActivities,
        ...skill.activityTemplates,
      ])
      existing.portfolioEvidence = dedupeStrings([
        ...existing.portfolioEvidence,
        ...skill.portfolioEvidence,
      ])
    }
  }

  return [...byId.values()]
}

export const SKILL_CATALOG: readonly z.infer<typeof SkillCatalogEntrySchema>[] =
  SkillCatalogEntrySchema.array().parse(buildSkillCatalog())

const SKILL_BY_ID = new Map(SKILL_CATALOG.map((entry) => [entry.id, entry]))
const SKILL_BY_NORMALIZED_NAME = new Map(
  SKILL_CATALOG.map((entry) => [entry.normalizedName, entry]),
)

export function getSkillById(skillId: string): z.infer<typeof SkillCatalogEntrySchema> | undefined {
  return SKILL_BY_ID.get(skillId)
}

export function findSkillByName(
  rawName: string,
): z.infer<typeof SkillCatalogEntrySchema> | undefined {
  return SKILL_BY_NORMALIZED_NAME.get(rawName.trim().replace(/\s+/g, ' ').toLowerCase())
}

export function getSkillPracticeAreas(
  skills: readonly z.infer<typeof SkillExposureSchema>[],
): z.infer<typeof SkillPracticeAreaSchema>[] {
  return skills
    .filter((skill) => skill.requiresPractice)
    .slice()
    .sort((a, b) => {
      const importance = IMPORTANCE_RANK[b.importance] - IMPORTANCE_RANK[a.importance]
      if (importance !== 0) return importance
      return (a.estimatedExposurePct ?? 0) - (b.estimatedExposurePct ?? 0)
    })
    .map((skill) => ({
      skillId: skill.skillId,
      name: skill.name,
      importance: skill.importance,
      status: skill.status,
      estimatedExposurePct: skill.estimatedExposurePct,
      reason:
        skill.status === 'NOT_STARTED'
          ? 'The supporting module is in your plan but has not been started.'
          : skill.status === 'UNAVAILABLE'
            ? 'Progress for a supporting module is unavailable, so exposure cannot be estimated yet.'
            : `Estimated exposure is ${skill.estimatedExposurePct ?? 0}% from partial module progress.`,
      practiceActivities: skill.practiceActivities,
      portfolioEvidence: skill.portfolioEvidence,
    }))
}

export type SkillStatus = z.infer<typeof SkillStatusSchema>
export type SkillCatalogEntry = z.infer<typeof SkillCatalogEntrySchema>
export type SkillExposureModule = z.infer<typeof SkillExposureModuleSchema>
export type SkillEvidenceSource = z.infer<typeof SkillEvidenceSourceSchema>
export type SkillExposure = z.infer<typeof SkillExposureSchema>
export type SkillPracticeArea = z.infer<typeof SkillPracticeAreaSchema>
export type SkillographyTrack = z.infer<typeof SkillographyTrackSchema>
export type ModuleSkillLink = z.infer<typeof ModuleSkillLinkSchema>
export type ModuleSkillMapping = z.infer<typeof ModuleSkillMappingSchema>
export type SkillListResponse = z.infer<typeof SkillListResponseSchema>
export type SkillographyResponse = z.infer<typeof SkillographyResponseSchema>
