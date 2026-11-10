import { z } from 'zod'
import { EmailSchema, IsoDateTimeSchema } from './common'

export const StudentSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(200),
  email: EmailSchema,
  mustChangePassword: z.boolean(),
  createdAt: IsoDateTimeSchema,
})

export const StudentProfileSchema = StudentSchema.pick({
  id: true,
  name: true,
  email: true,
})

export type Student = z.infer<typeof StudentSchema>
export type StudentProfile = z.infer<typeof StudentProfileSchema>
