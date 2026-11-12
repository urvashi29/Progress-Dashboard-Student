import type { Knex } from 'knex'
import session from 'express-session'

type SessionRow = {
  sid: string
  data: string
  expires_at: number | string
}

/**
 * Minimal express-session store backed by the existing Knex connection. Keeping
 * sessions server-side means a cookie alone can be invalidated on logout, and
 * no session data is exposed to the browser beyond an opaque id.
 */
export class KnexSessionStore extends session.Store {
  constructor(
    private readonly db: Knex,
    private readonly fallbackTtlMs: number,
  ) {
    super()
  }

  private expiryFor(sess?: session.SessionData): number {
    const expires = sess?.cookie?.expires
    if (expires) return new Date(expires).getTime()
    return Date.now() + this.fallbackTtlMs
  }

  override get(
    sid: string,
    callback: (err: unknown, session?: session.SessionData | null) => void,
  ): void {
    void this.db('sessions')
      .where({ sid })
      .first<SessionRow>()
      .then(async (row) => {
        if (!row) return callback(null, null)
        if (Number(row.expires_at) <= Date.now()) {
          await this.db('sessions').where({ sid }).del()
          return callback(null, null)
        }
        return callback(null, JSON.parse(row.data) as session.SessionData)
      })
      .catch((error: unknown) => callback(error))
  }

  override set(
    sid: string,
    sess: session.SessionData,
    callback?: (err?: unknown) => void,
  ): void {
    const expiresAt = this.expiryFor(sess)
    const row = {
      sid,
      data: JSON.stringify(sess),
      expires_at: expiresAt,
      created_at: new Date().toISOString(),
    }

    void this.db('sessions')
      .insert(row)
      .onConflict('sid')
      .merge(['data', 'expires_at'])
      .then(() => callback?.())
      .catch((error: unknown) => callback?.(error))
  }

  override touch(
    sid: string,
    sess: session.SessionData,
    callback?: (err?: unknown) => void,
  ): void {
    void this.db('sessions')
      .where({ sid })
      .update({ expires_at: this.expiryFor(sess) })
      .then(() => callback?.())
      .catch((error: unknown) => callback?.(error))
  }

  override destroy(sid: string, callback?: (err?: unknown) => void): void {
    void this.db('sessions')
      .where({ sid })
      .del()
      .then(() => callback?.())
      .catch((error: unknown) => callback?.(error))
  }
}
