import {
  ActivityTemplateSchema,
  DashboardModuleSchema,
  IsoDateTimeSchema,
  SkillSchema,
} from '@spd/shared'
import { z } from 'zod'

/**
 * Phase 2 module views. The dashboard module summary reuses the shared
 * `DashboardModuleSchema`; these list/detail envelopes are additive and
 * server-local so the foundation-owned shared contracts stay untouched.
 */
export const ModuleActivitySchema = ActivityTemplateSchema.extend({
  skill: z.string().min(1),
})

export const ModuleListResponseSchema = z.object({
  modules: z.array(DashboardModuleSchema).length(13),
  generatedAt: IsoDateTimeSchema,
})

export const ModuleDetailResponseSchema = z.object({
  module: DashboardModuleSchema,
  skills: z.array(SkillSchema),
  activities: z.array(ModuleActivitySchema),
  prerequisites: z.array(DashboardModuleSchema),
  minutesPerProgressPoint: z.number().finite().positive(),
  skillsAreEstimated: z.literal(true),
  caveat: z.string().min(1),
  generatedAt: IsoDateTimeSchema,
})

export type ModuleActivity = z.infer<typeof ModuleActivitySchema>
export type ModuleListResponse = z.infer<typeof ModuleListResponseSchema>
export type ModuleDetailResponse = z.infer<typeof ModuleDetailResponseSchema>
