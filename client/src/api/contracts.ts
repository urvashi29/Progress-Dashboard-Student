import {
  ActivityTemplateSchema,
  CatalogModuleSchema,
  ConfidenceSchema,
  DashboardModuleSchema,
  ModuleProgressBandSchema,
  PercentSchema,
  SlugSchema,
} from '@spd/shared'
import { z } from 'zod'

/**
 * Local contract for GET /api/v1/me/modules/:slug. It composes the shared
 * DashboardModule and CatalogModule contracts so the UI never invents fields.
 * The backend team should return these fields (see docs in the completion
 * report); until then MSW serves a contract-compatible response.
 */
export const PrerequisiteModuleSchema = z.object({
  moduleSlug: SlugSchema,
  name: z.string().min(1),
  progressPct: PercentSchema.nullable(),
  inPlan: z.boolean(),
  band: ModuleProgressBandSchema.nullable(),
})

export const ModuleDetailResponseSchema = z.object({
  module: DashboardModuleSchema,
  catalog: CatalogModuleSchema,
  prerequisites: z.array(PrerequisiteModuleSchema),
  suggestedActivities: z.array(ActivityTemplateSchema),
  skillsAreEstimated: z.literal(true),
  confidence: ConfidenceSchema,
  caveat: z.string().min(1),
})

export type PrerequisiteModule = z.infer<typeof PrerequisiteModuleSchema>
export type ModuleDetailResponse = z.infer<typeof ModuleDetailResponseSchema>
