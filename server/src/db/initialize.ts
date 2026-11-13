import type { Knex } from 'knex'

const SESSION_COLUMNS = ['sid', 'data', 'expires_at', 'created_at'] as const

export async function assertSessionStoreReady(db: Knex): Promise<void> {
  if (!(await db.schema.hasTable('sessions'))) {
    throw new Error('Database is not initialized: the sessions table is missing')
  }

  const columns = await db('sessions').columnInfo()
  const missing = SESSION_COLUMNS.filter((column) => !(column in columns))

  if (missing.length > 0) {
    throw new Error(
      `Database is not initialized: the sessions table is missing columns ${missing.join(', ')}`,
    )
  }
}

export async function initializeDatabase(db: Knex): Promise<string[]> {
  const [, applied] = await db.migrate.latest()
  await assertSessionStoreReady(db)
  return applied
}
