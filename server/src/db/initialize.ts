import type { Knex } from 'knex'

const SESSION_COLUMNS = ['sid', 'data', 'expires_at', 'created_at'] as const

export interface DatabaseInitializationResult {
  applied: string[]
  repairedSessionsTable: boolean
}

/**
 * The sessions table is owned by migration 0002 and by the KnexSessionStore
 * adapter. This fallback only repairs a database whose migration history claims
 * initialization while the table is missing; it never drops or resets data.
 * Keep this schema identical to migration 0002.
 */
export async function ensureSessionStoreSchema(db: Knex): Promise<boolean> {
  if (await db.schema.hasTable('sessions')) return false

  try {
    await db.schema.createTable('sessions', (table) => {
      table.string('sid', 128).primary()
      table.text('data').notNullable()
      table.bigInteger('expires_at').notNullable()
      table.string('created_at', 40).notNullable()
      table.index('expires_at')
    })
  } catch (error) {
    // Another process may have created it after our hasTable check.
    if (!(await db.schema.hasTable('sessions'))) throw error
    return false
  }

  return true
}

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

export async function initializeDatabase(db: Knex): Promise<DatabaseInitializationResult> {
  const [, applied] = await db.migrate.latest()
  const repairedSessionsTable = await ensureSessionStoreSchema(db)
  await assertSessionStoreReady(db)
  return { applied, repairedSessionsTable }
}
