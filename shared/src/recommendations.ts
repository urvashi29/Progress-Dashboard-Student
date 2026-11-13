import { z } from 'zod'
import {
  ConfidenceSchema,
  IsoDateSchema,
  IsoDateTimeSchema,
  PercentSchema,
  SlugSchema,
  TrackSlugSchema,
} from './common'
import { SkillImportanceSchema } from './modules'

export const RecommendationTypeSchema = z.enum([
  'START_MODULE',
  'CONTINUE_MODULE',
  'NEAR_FINISH',
  'COMPLETE_PREREQUISITE',
  'EXPLORE_NEXT',
  // Legacy values kept so older persisted/placeholder payloads stay readable.
  'RESCUE_MODULE',
  'QUICK_WIN',
  'UNBLOCK',
  'MOMENTUM',
])

export const CoachRecommendationActionSchema = z.enum([
  'CONTINUE_MODULE',
  'VIEW_MODULE',
])

export const CoachSkillReferenceSchema = z.object({
  id: SlugSchema,
  name: z.string().min(1),
  importance: SkillImportanceSchema,
})

export const CoachAssessmentAvailabilitySchema = z.object({
  /** False until verified assessment results are available from the platform. */
  available: z.literal(false),
  quizzes: z.literal('unavailable'),
  codingQuestions: z.literal('unavailable'),
  midCourseAssessments: z.literal('unavailable'),
  endCourseAssessments: z.literal('unavailable'),
  note: z.string().min(1),
})

export const CoachRecommendationSchema = z.object({
  id: z.string().min(1),
  type: RecommendationTypeSchema,
  moduleSlug: SlugSchema,
  moduleName: z.string().min(1),
  track: TrackSlugSchema,
  title: z.string().min(1),
  /** Deterministic, factual reason derived only from module progress/catalog. */
  reason: z.string().min(1),
  /** Natural-language explanation from Gemini, or a deterministic fallback. */
  explanation: z.string().min(1),
  priority: z.number().int().nonnegative(),
  progressPct: PercentSchema,
  inPlan: z.boolean(),
  action: CoachRecommendationActionSchema,
  skills: z.array(CoachSkillReferenceSchema).max(4),
  /**
   * Deliberately nullable: the platform has no verified per-module time data,
   * so the coach never invents a time estimate.
   */
  estimatedMinutes: z.number().int().positive().nullable(),
  /** Deliberately nullable: no fabricated gain estimates. */
  expectedGainPct: PercentSchema.nullable(),
})

export const CoachGeneratedBySchema = z.enum(['gemini', 'fallback'])

export const CoachSummarySchema = z.object({
  headline: z.string().min(1),
  recommendations: z.array(CoachRecommendationSchema).max(3),
  generatedBy: CoachGeneratedBySchema,
  assessmentData: CoachAssessmentAvailabilitySchema,
  disclaimer: z.string().min(1),
  generatedAt: IsoDateTimeSchema,
})

export const CoachModuleGuideSchema = z.object({
  moduleSlug: SlugSchema,
  moduleName: z.string().min(1),
  progressPct: PercentSchema,
  inPlan: z.boolean(),
  guidance: z.array(z.string().min(1)).min(3).max(5),
  generatedBy: CoachGeneratedBySchema,
  assessmentData: CoachAssessmentAvailabilitySchema,
  disclaimer: z.string().min(1),
  generatedAt: IsoDateTimeSchema,
})

export const CoachAskRequestSchema = z.object({
  question: z.string().trim().min(2).max(500),
  moduleSlug: SlugSchema.optional(),
})

export const CoachAskResponseSchema = z.object({
  answer: z.string().min(1),
  generatedBy: CoachGeneratedBySchema,
  contextModuleSlugs: z.array(SlugSchema),
  assessmentData: CoachAssessmentAvailabilitySchema,
  disclaimer: z.string().min(1),
  generatedAt: IsoDateTimeSchema,
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
export type CoachRecommendationAction = z.infer<typeof CoachRecommendationActionSchema>
export type CoachSkillReference = z.infer<typeof CoachSkillReferenceSchema>
export type CoachAssessmentAvailability = z.infer<
  typeof CoachAssessmentAvailabilitySchema
>
export type CoachRecommendation = z.infer<typeof CoachRecommendationSchema>
export type CoachSummary = z.infer<typeof CoachSummarySchema>
export type CoachModuleGuide = z.infer<typeof CoachModuleGuideSchema>
export type CoachAskRequest = z.infer<typeof CoachAskRequestSchema>
export type CoachAskResponse = z.infer<typeof CoachAskResponseSchema>
export type PlanStep = z.infer<typeof PlanStepSchema>
export type FastPlan = z.infer<typeof FastPlanSchema>
