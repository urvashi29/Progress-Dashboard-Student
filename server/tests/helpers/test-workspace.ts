import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { Knex } from 'knex'

export type TestWorkspace = {
  dir: string
  privateDir: string
  cleanup: () => void
}

/**
 * Must run before importing any `src` module: `config/env` validates and caches
 * process.env at import time.
 */
export function prepareTestEnvironment(
  overrides: Record<string, string> = {},
): TestWorkspace {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spd-phase1-'))
  const privateDir = path.join(dir, 'private')

  Object.assign(process.env, {
    NODE_ENV: 'test',
    PORT: '4000',
    CORS_ORIGIN: 'http://localhost:5173',
    DB_CLIENT: 'better-sqlite3',
    SQLITE_PATH: path.join(dir, 'test.sqlite'),
    SESSION_SECRET: 'test-session-secret-0123456789abcdef',
    SESSION_COOKIE_NAME: 'spd.sid',
    SESSION_TTL_HOURS: '1',
    BCRYPT_ROUNDS: '4',
    DEMO_DEFAULT_PASSWORD: 'DemoPassw0rd!',
    ADMIN_EMAIL: 'admin@example.com',
    PRIVATE_DATA_DIR: privateDir,
    IMPORT_MAX_FILE_BYTES: '1048576',
    LOGIN_RATE_LIMIT_MAX: '50',
    LOGIN_RATE_LIMIT_WINDOW_MINUTES: '15',
    ...overrides,
  })

  return {
    dir,
    privateDir,
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  }
}

export async function bootstrapDatabase(): Promise<Knex> {
  const { db } = await import('../../src/db/client')
  const { initializeDatabase } = await import('../../src/db/initialize')
  await initializeDatabase(db)
  const { seedCatalog } = await import('../../src/db/seed-catalog')
  await seedCatalog(db)
  return db
}
