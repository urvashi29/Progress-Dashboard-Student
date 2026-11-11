import fs from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'
import { z } from 'zod'

export const serverRoot = path.resolve(__dirname, '../..')
export const repoRoot = path.resolve(serverRoot, '..')

for (const envPath of [path.join(repoRoot, '.env'), path.join(serverRoot, '.env')]) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false })
  }
}

const optionalString = z.preprocess(
  (value) => (value === '' || value === undefined ? undefined : value),
  z.string().min(1).optional(),
)

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().max(65535).default(4000),
  DB_CLIENT: z.enum(['better-sqlite3', 'pg']).default('better-sqlite3'),
  SQLITE_PATH: z.string().min(1).default('data/dev.sqlite'),
  DATABASE_URL: optionalString,
  CORS_ORIGIN: z.string().min(1).default('http://localhost:5173'),
  SESSION_SECRET: z.preprocess(
    (value) => (value === '' || value === undefined ? undefined : value),
    z.string().min(16).optional(),
  ),
  SESSION_COOKIE_NAME: z.string().min(1).default('spd.sid'),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().max(24 * 30).default(12),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
  DEMO_DEFAULT_PASSWORD: optionalString,
  ADMIN_EMAIL: z.preprocess(
    (value) => (value === '' || value === undefined ? undefined : value),
    z.string().email().optional(),
  ),
  PRIVATE_DATA_DIR: z.string().min(1).default('data/private'),
  IMPORT_MAX_FILE_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),
  LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),
  LOGIN_RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().positive().default(15),
})

const parsed = EnvSchema.safeParse(process.env)
if (!parsed.success) {
  console.error('[env] Invalid environment configuration', parsed.error.flatten().fieldErrors)
  throw new Error('Invalid environment configuration')
}

export const env = parsed.data

if (env.DB_CLIENT === 'pg' && !env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required when DB_CLIENT=pg')
}

if (env.NODE_ENV === 'production' && !env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET is required when NODE_ENV=production')
}

/**
 * Development/test fallback only. Production is rejected above unless a real
 * secret is supplied; this value is never used by the production environment.
 */
export const sessionSecret =
  env.SESSION_SECRET ?? 'insecure-development-session-secret-change-me'

export const sqliteFile = path.isAbsolute(env.SQLITE_PATH)
  ? env.SQLITE_PATH
  : path.resolve(serverRoot, env.SQLITE_PATH)

export const privateDataDir = path.isAbsolute(env.PRIVATE_DATA_DIR)
  ? env.PRIVATE_DATA_DIR
  : path.resolve(serverRoot, env.PRIVATE_DATA_DIR)
