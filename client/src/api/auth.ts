import { StudentProfileSchema, type StudentProfile } from '@spd/shared'
import { z } from 'zod'
import { ApiError, apiRequest, apiRequestVoid } from './client'

const SessionPayloadSchema = z.union([
  StudentProfileSchema,
  z.object({ student: StudentProfileSchema }).transform((value) => value.student),
])

export async function loginRequest(email: string, password: string): Promise<StudentProfile> {
  return apiRequest('/auth/login', SessionPayloadSchema, {
    method: 'POST',
    body: { email, password },
  })
}

export async function logoutRequest(): Promise<void> {
  await apiRequestVoid('/auth/logout', { method: 'POST' })
}

export async function fetchSession(signal?: AbortSignal): Promise<StudentProfile | null> {
  try {
    return await apiRequest('/auth/me', SessionPayloadSchema, { signal })
  } catch (error) {
    if (error instanceof ApiError && error.isUnauthorized) return null
    throw error
  }
}
