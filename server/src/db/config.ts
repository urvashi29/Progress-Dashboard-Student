import fs from 'node:fs'
import path from 'node:path'
import type { Knex } from 'knex'
import { env, sqliteFile } from '../config/env'

const migrations: Knex.MigratorConfig = {
  directory: path.resolve(__dirname, '../../migrations'),
  extension: 'js',
  loadExtensions: ['.js'],
  tableName: 'knex_migrations',
}

/**
 * SQLite is the development default. Setting DB_CLIENT=pg + DATABASE_URL
 * switches to PostgreSQL without changing schema code (dialect-neutral Knex
 * migrations, ISO-8601 text date columns).
 */
export function createDbConfig(): Knex.Config {
  if (env.DB_CLIENT === 'pg') {
    if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required when DB_CLIENT=pg')
    return {
      client: 'pg',
      connection: env.DATABASE_URL,
      pool: { min: 0, max: 10 },
      migrations,
    }
  }

  fs.mkdirSync(path.dirname(sqliteFile), { recursive: true })

  return {
    client: 'better-sqlite3',
    connection: { filename: sqliteFile },
    useNullAsDefault: true,
    pool: {
      min: 1,
      max: 1,
      afterCreate: (
        connection: { pragma: (statement: string) => unknown },
        done: (error: Error | null, connection: unknown) => void,
      ) => {
        try {
          connection.pragma('foreign_keys = ON')
          done(null, connection)
        } catch (error) {
          done(error as Error, connection)
        }
      },
    },
    migrations,
  }
}
