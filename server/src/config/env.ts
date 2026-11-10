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
  DEMO_DEFAULT_PASSWORD: optionalString,
  ADMIN_EMAIL: z.preprocess(
    (value) => (value === '' || value === undefined ? undefined : value),
    z.string().email().optional(),
  ),
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

export const sqliteFile = path.isAbsolute(env.SQLITE_PATH)
  ? env.SQLITE_PATH
  : path.resolve(serverRoot, env.SQLITE_PATH)
