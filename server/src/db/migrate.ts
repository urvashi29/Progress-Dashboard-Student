import { env, sqliteFile } from '../config/env'
import { db } from './client'
import { initializeDatabase } from './initialize'

async function main(): Promise<void> {
  const location = env.DB_CLIENT === 'pg' ? 'PostgreSQL' : `SQLite (${sqliteFile})`
  const { applied, repairedSessionsTable } = await initializeDatabase(db)
  console.log(`[db] ${location} — ${applied.length} migration(s) applied`)
  if (repairedSessionsTable) {
    console.warn('[db] Repaired missing sessions table without resetting data')
  }
}

void main()
  .catch((error: unknown) => {
    console.error('[db] Migration failed', error)
    process.exitCode = 1
  })
  .finally(() => {
    void db.destroy()
  })
