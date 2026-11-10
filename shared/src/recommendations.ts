import { z } from 'zod'
import { ConfidenceSchema, IsoDateSchema, PercentSchema, SlugSchema } from './common'

export const RecommendationTypeSchema = z.enum([
  'START_MODULE',
  'RESCUE_MODULE',
  'NEAR_FINISH',
  'QUICK_WIN',
  'UNBLOCK',
  'MOMENTUM',
])

export const RecommendationSchema = z.object({
  id: z.string().min(1),
  type: RecommendationTypeSchema,
  moduleSlug: SlugSchema,
  title: z.string().min(1),
  reason: z.string().min(1),
  priority: z.number().int().nonnegative(),
  estimatedMinutes: z.number().int().positive().nullable(),
  expectedGainPct: PercentSchema.nullable(),
})

export const CoachSummarySchema = z.object({
  headline: z.string().min(1),
  recommendations: z.array(RecommendationSchema),
})

export const PlanStepSchema = z.object({
  order: z.number().int().positive(),
  skill: z.string().min(1),
  action: z.string().min(1),
  minutes: z.number().int().positive(),
  expectedGainPct: PercentSchema,
  why: z.string().min(1),
})

export const FastPlanSchema = z.object({
  module: SlugSchema,
  currentProgress: PercentSchema,
  remaining: PercentSchema,
  steps: z.array(PlanStepSchema),
  totalMinutes: z.number().int().nonnegative(),
  projectedCompletionDate: IsoDateSchema,
  confidence: ConfidenceSchema,
  caveat: z.string().min(1),
  estimated: z.literal(true),
})

export type RecommendationType = z.infer<typeof RecommendationTypeSchema>
export type Recommendation = z.infer<typeof RecommendationSchema>
export type CoachSummary = z.infer<typeof CoachSummarySchema>
export type PlanStep = z.infer<typeof PlanStepSchema>
export type FastPlan = z.infer<typeof FastPlanSchema>
