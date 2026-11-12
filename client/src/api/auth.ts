import { StudentProfileSchema, type StudentProfile } from '@spd/shared'
import { z } from 'zod'
import { ApiError, apiRequest, apiRequestVoid, setCsrfToken } from './client'

const CsrfResponseSchema = z.object({ csrfToken: z.string().min(1) })

/**
 * The session endpoints return the student profile plus the rotated CSRF token.
 * Unknown fields are stripped, so this stays compatible with a bare profile.
 */
const SessionPayloadSchema = z.union([
  z.object({ student: StudentProfileSchema, csrfToken: z.string().optional() }),
  StudentProfileSchema.transform((student) => ({ student, csrfToken: undefined })),
])

async function fetchCsrfToken(signal?: AbortSignal): Promise<string> {
  const { csrfToken } = await apiRequest('/auth/csrf', CsrfResponseSchema, { signal })
  setCsrfToken(csrfToken)
  return csrfToken
}

function applySessionPayload(payload: z.output<typeof SessionPayloadSchema>): StudentProfile {
  if (payload.csrfToken) setCsrfToken(payload.csrfToken)
  return payload.student
}

export async function loginRequest(
  email: string,
  password: string,
  signal?: AbortSignal,
): Promise<StudentProfile> {
  await fetchCsrfToken(signal)
  const payload = await apiRequest('/auth/login', SessionPayloadSchema, {
    method: 'POST',
    body: { email, password },
    signal,
  })
  return applySessionPayload(payload)
}

export async function logoutRequest(): Promise<void> {
  try {
    await fetchCsrfToken()
  } catch {
    // Without a server session there is nothing to invalidate; clearing local
    // CSRF state below still prevents replaying a stale token.
  }
  try {
    await apiRequestVoid('/auth/logout', { method: 'POST' })
  } finally {
    setCsrfToken(null)
  }
}

export async function fetchSession(signal?: AbortSignal): Promise<StudentProfile | null> {
  try {
    const payload = await apiRequest('/auth/me', SessionPayloadSchema, { signal })
    return applySessionPayload(payload)
  } catch (error) {
    if (error instanceof ApiError && error.isUnauthorized) return null
    throw error
  }
}
