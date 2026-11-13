import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import knex, { type Knex } from 'knex'
import session from 'express-session'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spd-session-'))
process.env.NODE_ENV = 'test'
process.env.DB_CLIENT = 'better-sqlite3'
process.env.SQLITE_PATH = path.join(tempDir, 'test.sqlite')
process.env.SESSION_SECRET = 'test-session-secret-0123456789abcdef'

let db: Knex
let store: InstanceType<typeof import('../src/db/session-store').KnexSessionStore>
let applied: string[]
let assertSessionStoreReady: typeof import('../src/db/initialize').assertSessionStoreReady

const SID = 'fictional-test-session'
const SESSION = {
  cookie: {
    originalMaxAge: 60_000,
    expires: new Date(Date.now() + 60_000),
    httpOnly: true,
    path: '/',
  },
  studentId: 1,
  role: 'student',
  csrfToken: 'fictional-csrf-token',
} as session.SessionData

function setSession(sid: string, data: session.SessionData): Promise<void> {
  return new Promise((resolve, reject) => {
    store.set(sid, data, (error) => (error ? reject(error) : resolve()))
  })
}

function getSession(sid: string): Promise<session.SessionData | null | undefined> {
  return new Promise((resolve, reject) => {
    store.get(sid, (error, data) => (error ? reject(error) : resolve(data)))
  })
}

function touchSession(sid: string, data: session.SessionData): Promise<void> {
  return new Promise((resolve, reject) => {
    store.touch(sid, data, (error) => (error ? reject(error) : resolve()))
  })
}

function destroySession(sid: string): Promise<void> {
  return new Promise((resolve, reject) => {
    store.destroy(sid, (error) => (error ? reject(error) : resolve()))
  })
}

beforeAll(async () => {
  const clientModule = await import('../src/db/client')
  db = clientModule.db

  const initializeModule = await import('../src/db/initialize')
  assertSessionStoreReady = initializeModule.assertSessionStoreReady
  applied = await initializeModule.initializeDatabase(db)

  const storeModule = await import('../src/db/session-store')
  store = new storeModule.KnexSessionStore(db, 60_000)
})

afterAll(async () => {
  if (db) await db.destroy()
  fs.rmSync(tempDir, { recursive: true, force: true })
})

describe('database startup initialization', () => {
  it('applies migrations and creates the session store schema', async () => {
    expect(applied.length).toBeGreaterThan(0)
    expect(await db.schema.hasTable('sessions')).toBe(true)

    const columns = await db('sessions').columnInfo()
    expect(Object.keys(columns)).toEqual(
      expect.arrayContaining(['sid', 'data', 'expires_at', 'created_at']),
    )
  })

  it('rejects a database without the sessions table', async () => {
    const emptyDb = knex({
      client: 'better-sqlite3',
      connection: { filename: path.join(tempDir, 'empty.sqlite') },
      useNullAsDefault: true,
    })

    try {
      await expect(assertSessionStoreReady(emptyDb)).rejects.toThrow(
        /sessions table is missing/,
      )
    } finally {
      await emptyDb.destroy()
    }
  })
})

describe('KnexSessionStore', () => {
  it('stores, retrieves, touches, and deletes a session', async () => {
    await setSession(SID, SESSION)

    const stored = await getSession(SID)
    expect(stored).toMatchObject({
      studentId: 1,
      role: 'student',
      csrfToken: 'fictional-csrf-token',
    })

    const row = await db('sessions').where({ sid: SID }).first<{
      expires_at: number | string
      created_at: string
    }>()
    expect(row).toBeTruthy()
    expect(row?.created_at).toEqual(expect.any(String))

    await touchSession(SID, SESSION)
    const touched = await db('sessions').where({ sid: SID }).first<{
      expires_at: number | string
    }>()
    expect(Number(touched?.expires_at)).toBeGreaterThan(Date.now())

    await destroySession(SID)
    expect(await getSession(SID)).toBeNull()
    expect(await db('sessions').where({ sid: SID }).first()).toBeUndefined()
  })
})
