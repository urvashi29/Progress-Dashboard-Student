import { z } from 'zod'
import {
  ConfidenceSchema,
  IsoDateSchema,
  PercentSchema,
  SlugSchema,
  TrackSlugSchema,
} from './common'

export const TrackSchema = z.object({
  slug: TrackSlugSchema,
  name: z.string().min(1),
  order: z.number().int().positive(),
})

export const ActivityTypeSchema = z.enum(['reading', 'practice', 'quiz', 'project'])

export const ActivityTemplateSchema = z.object({
  title: z.string().min(1),
  type: ActivityTypeSchema,
  minutes: z.number().int().positive(),
})

export const SkillImportanceSchema = z.enum(['critical', 'core', 'supporting'])

/**
 * Skills are inferred from module progress, never measured. `estimated` is a
 * literal `true` so a measured-proficiency claim cannot be represented.
 */
export const SkillSchema = z.object({
  name: z.string().min(1),
  importance: SkillImportanceSchema,
  weight: z.number().finite().min(0).max(1),
  estimated: z.literal(true),
  confidence: ConfidenceSchema,
  prereqSkillNames: z.array(z.string().min(1)).default([]),
  activityTemplates: z.array(ActivityTemplateSchema).default([]),
})

export const CatalogModuleSchema = z.object({
  slug: SlugSchema,
  name: z.string().min(1),
  normalizedName: z.string().min(1),
  track: TrackSlugSchema,
  catalogOrder: z.number().int().positive(),
  aliases: z.array(z.string().min(1)).default([]),
  prerequisiteModuleSlugs: z.array(SlugSchema).default([]),
  minutesPerProgressPoint: z.number().finite().positive(),
  skills: z.array(SkillSchema).min(1),
})

export const CatalogResponseSchema = z.object({
  tracks: z.array(TrackSchema).min(1),
  modules: z.array(CatalogModuleSchema).min(1),
  skillsAreEstimated: z.literal(true),
  note: z.string().min(1),
})

export const ModuleProgressBandSchema = z.enum([
  'STRONG',
  'ON_TRACK',
  'NEEDS_ATTENTION',
  'NOT_STARTED',
  'NOT_IN_PLAN',
])

export const ModuleProgressRecordSchema = z.object({
  enrollmentId: z.number().int().positive(),
  moduleSlug: SlugSchema,
  progressPct: PercentSchema,
  inPlan: z.boolean(),
  updatedAt: IsoDateSchema,
})

const moduleProgressShape = {
  moduleSlug: SlugSchema,
  progressPct: PercentSchema,
  inPlan: z.boolean(),
  updatedAt: IsoDateSchema,
}

function checkBand(
  value: { progressPct: number; inPlan: boolean; band: ModuleProgressBand },
  ctx: z.RefinementCtx,
): void {
  const expected = moduleProgressBand(value.progressPct, value.inPlan)
  if (value.band !== expected) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['band'],
      message: `Band must be ${expected} for progress ${value.progressPct} (inPlan: ${value.inPlan})`,
    })
  }
}

export const ModuleProgressSchema = z
  .object({
    ...moduleProgressShape,
    band: ModuleProgressBandSchema,
  })
  .superRefine(checkBand)

export const DashboardModuleSchema = z
  .object({
    ...moduleProgressShape,
    band: ModuleProgressBandSchema,
    name: z.string().min(1),
    track: TrackSlugSchema,
    catalogOrder: z.number().int().positive(),
    prerequisiteModuleSlugs: z.array(SlugSchema),
  })
  .superRefine(checkBand)

/**
 * Absolute module bands. `inPlan: false` is distinct from real 0% progress.
 */
export function moduleProgressBand(progressPct: number, inPlan: boolean): ModuleProgressBand {
  if (!inPlan) return 'NOT_IN_PLAN'
  if (progressPct >= 80) return 'STRONG'
  if (progressPct >= 50) return 'ON_TRACK'
  if (progressPct > 0) return 'NEEDS_ATTENTION'
  return 'NOT_STARTED'
}

export type Track = z.infer<typeof TrackSchema>
export type ActivityTemplate = z.infer<typeof ActivityTemplateSchema>
export type SkillImportance = z.infer<typeof SkillImportanceSchema>
export type Skill = z.infer<typeof SkillSchema>
export type CatalogModule = z.infer<typeof CatalogModuleSchema>
export type CatalogResponse = z.infer<typeof CatalogResponseSchema>
export type ModuleProgressBand = z.infer<typeof ModuleProgressBandSchema>
export type ModuleProgressRecord = z.infer<typeof ModuleProgressRecordSchema>
export type ModuleProgress = z.infer<typeof ModuleProgressSchema>
export type DashboardModule = z.infer<typeof DashboardModuleSchema>
