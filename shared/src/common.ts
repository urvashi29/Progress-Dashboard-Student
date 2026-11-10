import { z } from 'zod'

export const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected an ISO date (YYYY-MM-DD)')

export const IsoDateTimeSchema = z
  .string()
  .datetime({ offset: true, message: 'Expected an ISO date-time with offset' })

export const PercentSchema = z.number().finite().min(0).max(100)

export const EmailSchema = z.string().trim().email().max(320)

export const SlugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Expected a lowercase kebab-case slug')

export const TrackSlugSchema = z.enum([
  'foundations',
  'data-analytics',
  'ai-ml',
  'production-industry',
])

export const CourseTypeSchema = z.enum(['data-science', 'web3'])

export const ConfidenceSchema = z.enum(['low', 'medium', 'high'])

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export type IsoDate = z.infer<typeof IsoDateSchema>
export type IsoDateTime = z.infer<typeof IsoDateTimeSchema>
export type Percent = z.infer<typeof PercentSchema>
export type TrackSlug = z.infer<typeof TrackSlugSchema>
export type CourseType = z.infer<typeof CourseTypeSchema>
export type Confidence = z.infer<typeof ConfidenceSchema>
