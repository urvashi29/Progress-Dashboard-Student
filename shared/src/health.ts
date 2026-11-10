import { z } from 'zod'
import { IsoDateTimeSchema, PercentSchema } from './common'

export const HealthStatusSchema = z.enum([
  'GETTING_STARTED',
  'ON_TRACK',
  'SLIGHTLY_BEHIND',
  'BEHIND',
  'CRITICAL',
])

export const HealthAssessmentSchema = z.object({
  status: HealthStatusSchema,
  label: z.string().min(1),
  expectedPct: PercentSchema,
  paceRatio: z.number().finite().nonnegative().nullable(),
  staleDays: z.number().int().nonnegative(),
  downgraded: z.boolean(),
  reasons: z.array(z.string().min(1)).min(1),
  computedAt: IsoDateTimeSchema,
})

export const HealthStatusLabel: Record<HealthStatus, string> = {
  GETTING_STARTED: 'Getting Started',
  ON_TRACK: 'On Track',
  SLIGHTLY_BEHIND: 'Slightly Behind',
  BEHIND: 'Behind',
  CRITICAL: 'Critical',
}

export type HealthStatus = z.infer<typeof HealthStatusSchema>
export type HealthAssessment = z.infer<typeof HealthAssessmentSchema>
