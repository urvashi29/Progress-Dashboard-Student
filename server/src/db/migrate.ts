import { env, sqliteFile } from '../config/env'
import { db } from './client'

async function main(): Promise<void> {
  const [batch, applied] = await db.migrate.latest()
  const location = env.DB_CLIENT === 'pg' ? 'PostgreSQL' : `SQLite (${sqliteFile})`
  console.log(`[db] ${location} — batch ${batch}, ${applied.length} migration(s) applied`)
}

void main()
  .catch((error: unknown) => {
    console.error('[db] Migration failed', error)
    process.exitCode = 1
  })
  .finally(() => {
    void db.destroy()
  })
