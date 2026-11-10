import knex, { type Knex } from 'knex'
import { createDbConfig } from './config'

export const db: Knex = knex(createDbConfig())
