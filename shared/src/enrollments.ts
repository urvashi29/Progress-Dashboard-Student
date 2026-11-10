import { z } from 'zod'
import { CourseTypeSchema, IsoDateSchema, PercentSchema } from './common'

export const EnrollmentSchema = z.object({
  id: z.number().int().positive(),
  studentId: z.number().int().positive(),
  cohort: z.string().min(1).max(100),
  planType: z.string().min(1).max(200),
  subPlanType: z.string().min(1).max(200).nullable(),
  courseType: CourseTypeSchema,
  cohortStartDate: IsoDateSchema,
  enrolledAt: IsoDateSchema,
  accessExpiryDate: IsoDateSchema,
  overallProgressPct: PercentSchema,
  progressUpdatedAt: IsoDateSchema,
  importId: z.number().int().positive().nullable(),
})

export const EnrollmentSummarySchema = EnrollmentSchema.pick({
  id: true,
  cohort: true,
  planType: true,
  subPlanType: true,
  courseType: true,
  cohortStartDate: true,
  accessExpiryDate: true,
  overallProgressPct: true,
  progressUpdatedAt: true,
})

export type Enrollment = z.infer<typeof EnrollmentSchema>
export type EnrollmentSummary = z.infer<typeof EnrollmentSummarySchema>
