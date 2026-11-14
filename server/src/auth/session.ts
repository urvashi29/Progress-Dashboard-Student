import { randomBytes, timingSafeEqual } from 'node:crypto'
import type { Request, RequestHandler } from 'express'
import session from 'express-session'
import type { Knex } from 'knex'
import { env, sessionSecret } from '../config/env'
import { KnexSessionStore } from '../db/session-store'
import { INVALID_CSRF_MESSAGE } from './messages'

const SESSION_TTL_MS = env.SESSION_TTL_HOURS * 60 * 60 * 1000
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: env.NODE_ENV === 'production',
  path: '/',
}

export function createSessionMiddleware(db: Knex): RequestHandler {
  return session({
    name: env.SESSION_COOKIE_NAME,
    secret: sessionSecret,
    store: new KnexSessionStore(db, SESSION_TTL_MS),
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      ...sessionCookieOptions,
      maxAge: SESSION_TTL_MS,
    },
  })
}

export function ensureCsrfToken(req: Request): string {
  if (!req.session.csrfToken) {
    req.session.csrfToken = randomBytes(32).toString('hex')
  }
  return req.session.csrfToken
}

function tokensMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/**
 * Double-submit token tied to the server-side session. Required for every
 * cookie-authenticated state-changing route, including login (login CSRF).
 */
export const requireCsrf: RequestHandler = (req, res, next) => {
  if (SAFE_METHODS.has(req.method)) return next()

  const provided = req.get('x-csrf-token')
  const expected = req.session.csrfToken

  if (!provided || !expected || !tokensMatch(provided, expected)) {
    res.status(403).json({
      error: 'invalid_csrf_token',
      message: INVALID_CSRF_MESSAGE,
    })
    return
  }

  next()
}

export function regenerateSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => (error ? reject(error) : resolve()))
  })
}

export function saveSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.save((error) => (error ? reject(error) : resolve()))
  })
}

export function destroySession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.destroy((error) => (error ? reject(error) : resolve()))
  })
}
