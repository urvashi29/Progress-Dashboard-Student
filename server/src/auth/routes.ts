import { randomBytes } from 'node:crypto'
import { Router } from 'express'
import { z } from 'zod'
import { env } from '../config/env'
import { asyncHandler } from '../http/errors'
import { requireAuth } from './middleware'
import { verifyDummyPassword, verifyPassword } from './passwords'
import type { LoginRateLimiter } from './rate-limit'
import { buildAuthPayload, findStudentByEmail } from './service'
import {
  destroySession,
  ensureCsrfToken,
  regenerateSession,
  requireCsrf,
  saveSession,
  sessionCookieOptions,
} from './session'

const LoginBodySchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(1).max(256),
})

export function createAuthRouter(loginLimiter: LoginRateLimiter): Router {
  const router = Router()

  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store')
    next()
  })

  router.get('/csrf', (req, res) => {
    const csrfToken = ensureCsrfToken(req)
    res.json({ csrfToken })
  })

  router.post(
    '/login',
    loginLimiter.middleware,
    requireCsrf,
    asyncHandler(async (req, res) => {
      const body = LoginBodySchema.parse(req.body)
      const student = await findStudentByEmail(body.email)

      if (!student || !student.password_hash) {
        await verifyDummyPassword(body.password)
        res.status(401).json({ error: 'invalid_credentials' })
        return
      }

      const valid = await verifyPassword(body.password, student.password_hash)
      if (!valid) {
        res.status(401).json({ error: 'invalid_credentials' })
        return
      }

      // Prevent session fixation: throw away the pre-login session id.
      await regenerateSession(req)
      req.session.studentId = student.id
      req.session.email = student.email
      req.session.role = student.role
      req.session.csrfToken = randomBytes(32).toString('hex')
      await saveSession(req)

      loginLimiter.reset(loginLimiter.keyFor(req))
      const payload = await buildAuthPayload(student, req.session.csrfToken)
      res.status(200).json(payload)
    }),
  )

  router.post(
    '/logout',
    requireCsrf,
    asyncHandler(async (req, res) => {
      await destroySession(req)
      res.clearCookie(env.SESSION_COOKIE_NAME, sessionCookieOptions)
      res.status(204).end()
    }),
  )

  router.get(
    '/me',
    requireAuth,
    asyncHandler(async (req, res) => {
      const auth = req.auth
      if (!auth) {
        res.status(401).json({ error: 'unauthorized' })
        return
      }
      const csrfToken = ensureCsrfToken(req)
      await saveSession(req)
      const payload = await buildAuthPayload(
        {
          id: auth.studentId,
          name: auth.name,
          email: auth.email,
          must_change_password: auth.mustChangePassword,
        },
        csrfToken,
      )
      res.json(payload)
    }),
  )

  return router
}
