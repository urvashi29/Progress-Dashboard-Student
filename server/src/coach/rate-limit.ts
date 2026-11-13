export interface RateLimitResult {
  allowed: boolean
  retryAfterSeconds: number
}

interface Bucket {
  count: number
  resetAt: number
}

/**
 * Small in-process fixed-window limiter. It is intentionally local to this
 * single server process; a multi-instance deployment should replace it with a
 * shared store. Keys are derived from the authenticated student id, never from
 * request-supplied identifiers.
 */
export class CoachRateLimiter {
  private readonly buckets = new Map<string, Bucket>()

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  consume(key: string): RateLimitResult {
    const now = this.now()
    const existing = this.buckets.get(key)

    if (!existing || existing.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs })
      return { allowed: true, retryAfterSeconds: 0 }
    }

    if (existing.count >= this.max) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
      }
    }

    existing.count += 1
    return { allowed: true, retryAfterSeconds: 0 }
  }

  reset(key: string): void {
    this.buckets.delete(key)
  }
}
