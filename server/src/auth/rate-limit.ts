import type { Request, RequestHandler } from 'express'
import { normalizeEmail } from '@spd/shared'
import { env } from '../config/env'

type Bucket = { count: number; resetAt: number }

export type LoginRateLimiter = {
  middleware: RequestHandler
  keyFor: (req: Request) => string
  reset: (key: string) => void
  clear: () => void
}

function requestKey(req: Request): string {
  const email =
    req.body && typeof req.body === 'object' && typeof req.body.email === 'string'
      ? normalizeEmail(req.body.email)
      : 'unknown'
  return `${req.ip ?? 'unknown'}:${email}`
}

/**
 * Small in-memory limiter suitable for a single instance. Multi-instance
 * deployments should move this to Redis or the database (hardening phase).
 */
export function createLoginRateLimiter(options?: {
  max?: number
  windowMs?: number
}): LoginRateLimiter {
  const max = options?.max ?? env.LOGIN_RATE_LIMIT_MAX
  const windowMs =
    options?.windowMs ?? env.LOGIN_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000
  const buckets = new Map<string, Bucket>()

  const middleware: RequestHandler = (req, res, next) => {
    const key = requestKey(req)
    const now = Date.now()
    const existing = buckets.get(key)

    if (!existing || existing.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs })
      next()
      return
    }

    if (existing.count >= max) {
      const retryAfter = Math.max(1, Math.ceil((existing.resetAt - now) / 1000))
      res.setHeader('Retry-After', String(retryAfter))
      res.status(429).json({ error: 'too_many_requests' })
      return
    }

    existing.count += 1
    next()
  }

  return {
    middleware,
    keyFor: requestKey,
    reset: (key: string) => {
      buckets.delete(key)
    },
    clear: () => buckets.clear(),
  }
}
