import { z } from 'zod'
import { IsoDateTimeSchema, PercentSchema, TrackSlugSchema } from './common'
import { EnrollmentSchema } from './enrollments'
import { HealthAssessmentSchema } from './health'
import { DashboardModuleSchema } from './modules'
import { CoachSummarySchema } from './recommendations'
import { StudentProfileSchema } from './students'

export const TrackRollupSchema = z.object({
  track: TrackSlugSchema,
  name: z.string().min(1),
  moduleCount: z.number().int().nonnegative(),
  inPlanCount: z.number().int().nonnegative(),
  averageProgressPct: PercentSchema.nullable(),
})

export const ProgressComparisonSchema = z.object({
  moduleAveragePct: PercentSchema.nullable(),
  differenceFromOverallPct: z.number().finite().nullable(),
  note: z.string().min(1),
})

export const DashboardResponseSchema = z.object({
  student: StudentProfileSchema,
  enrollment: EnrollmentSchema,
  overallProgressPct: PercentSchema,
  health: HealthAssessmentSchema,
  tracks: z.array(TrackRollupSchema),
  modules: z.array(DashboardModuleSchema),
  coachSummary: CoachSummarySchema,
  progressComparison: ProgressComparisonSchema,
  generatedAt: IsoDateTimeSchema,
})

export type TrackRollup = z.infer<typeof TrackRollupSchema>
export type ProgressComparison = z.infer<typeof ProgressComparisonSchema>
export type DashboardResponse = z.infer<typeof DashboardResponseSchema>
