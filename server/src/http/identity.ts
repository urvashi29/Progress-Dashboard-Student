import type { Request } from 'express'

export interface SessionUser {
  id?: number
  studentId?: number
}

export interface SessionData {
  studentId?: number
  userId?: number
}

type AuthenticatedRequest = Request & {
  user?: SessionUser
  session?: SessionData
}

/**
 * Student identity always comes from the server-side session, never from a
 * request body, query string, or route parameter.
 *
 * Phase 1 integration: its auth middleware should attach either
 * `req.user.studentId` / `req.user.id` or `req.session.studentId` /
 * `req.session.userId`. Tests inject a resolver instead.
 */
export type IdentityResolver = (req: Request) => number | null | Promise<number | null>

export const sessionIdentityResolver: IdentityResolver = (req) => {
  const request = req as AuthenticatedRequest
  const candidate =
    request.user?.studentId ??
    request.user?.id ??
    request.session?.studentId ??
    request.session?.userId

  if (typeof candidate !== 'number' || !Number.isInteger(candidate) || candidate <= 0) {
    return null
  }
  return candidate
}
