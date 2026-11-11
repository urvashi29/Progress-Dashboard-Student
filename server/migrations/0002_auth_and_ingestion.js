/**
 * Phase 1 additions:
 *  - students.role so admin-only routes can be authorized explicitly
 *  - server-side sessions for HttpOnly cookie authentication
 *  - enrollments.overall_progress_pct nullable because the source workbook can
 *    omit the platform value; NULL means "not reported", never a recalculation.
 *
 * Append-only: 0001 is untouched. SQLite and PostgreSQL both run this file.
 */

/** @param {import('knex').Knex} knex */
exports.up = async function up(knex) {
  await knex.schema.alterTable('students', (table) => {
    table.string('role', 20).notNullable().defaultTo('student')
  })

  // SQLite rebuilds the table for this change (Knex handles it) and preserves
  // existing rows, indexes, and foreign keys.
  await knex.schema.alterTable('enrollments', (table) => {
    table.float('overall_progress_pct').nullable().alter()
  })

  // Re-importing the same workbook must not create a second import job.
  await knex.schema.alterTable('imports', (table) => {
    table.unique('file_hash', { indexName: 'imports_file_hash_unique' })
  })

  await knex.schema.createTable('sessions', (table) => {
    table.string('sid', 128).primary()
    table.text('data').notNullable()
    table.bigInteger('expires_at').notNullable()
    table.string('created_at', 40).notNullable()
    table.index('expires_at')
  })
}

/** @param {import('knex').Knex} knex */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('sessions')

  await knex.schema.alterTable('imports', (table) => {
    table.dropUnique('file_hash', 'imports_file_hash_unique')
  })

  // The original schema required a value. Replace unreported NULLs so the
  // rollback can re-apply NOT NULL without inventing a calculation.
  await knex('enrollments').whereNull('overall_progress_pct').update({ overall_progress_pct: 0 })
  await knex.schema.alterTable('enrollments', (table) => {
    table.float('overall_progress_pct').notNullable().alter()
  })

  await knex.schema.alterTable('students', (table) => {
    table.dropColumn('role')
  })
}
