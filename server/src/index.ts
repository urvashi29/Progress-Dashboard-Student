import { createApp } from './app'
import { env, sqliteFile } from './config/env'
import { db } from './db/client'
import { initializeDatabase } from './db/initialize'

async function main(): Promise<void> {
  const location = env.DB_CLIENT === 'pg' ? 'PostgreSQL' : `SQLite (${sqliteFile})`
  console.log(`[db] ${location}`)

  const { applied, repairedSessionsTable } = await initializeDatabase(db)
  if (applied.length > 0) {
    console.log(`[db] Applied ${applied.length} pending migration(s)`)
  }
  if (repairedSessionsTable) {
    console.warn('[db] Repaired missing sessions table without resetting data')
  }

  const app = createApp()

  const server = app.listen(env.PORT, () => {
    console.log(`[server] listening on http://localhost:${env.PORT} (${env.NODE_ENV})`)
  })

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      server.close(() => process.exit(0))
    })
  }
}

void main().catch(async (error: unknown) => {
  console.error(
    '[server] Startup failed',
    error instanceof Error ? error.message : 'unknown error',
  )
  process.exitCode = 1
  await db.destroy()
})
