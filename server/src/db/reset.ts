import { db } from './client'

async function main(): Promise<void> {
  const [, rolledBack] = await db.migrate.rollback(undefined, true)
  const [batch, applied] = await db.migrate.latest()
  console.log(
    `[db] Rolled back ${rolledBack.length} migration(s); batch ${batch} applied ${applied.length}`,
  )
}

void main()
  .catch((error: unknown) => {
    console.error('[db] Reset failed', error)
    process.exitCode = 1
  })
  .finally(() => {
    void db.destroy()
  })
