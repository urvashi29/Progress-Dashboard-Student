/**
 * Phase 0 community schema. Dialect-neutral on purpose: the same migrations
 * run on SQLite (development) and PostgreSQL (production).
 *
 * Dates/timestamps are stored as ISO-8601 text so API responses and Excel
 * serial conversions share one representation.
 */

/** @param {import('knex').Knex} knex */
exports.up = async function up(knex) {
  await knex.schema.createTable('students', (table) => {
    table.increments('id').primary()
    table.string('name', 200).notNullable()
    table.string('email', 320).notNullable().unique()
    // Null until Phase 1 provisions an account and stores a bcrypt hash.
    table.string('password_hash', 255).nullable()
    table.boolean('must_change_password').notNullable().defaultTo(true)
    table.string('created_at', 40).notNullable()
  })

  await knex.schema.createTable('modules', (table) => {
    table.increments('id').primary()
    table.string('slug', 120).notNullable().unique()
    table.string('name', 200).notNullable()
    table.string('normalized_name', 200).notNullable().unique()
    table.string('track', 40).notNullable()
    table.integer('catalog_order').notNullable()
    table.index(['track', 'catalog_order'])
  })

  await knex.schema.createTable('imports', (table) => {
    table.increments('id').primary()
    table.string('filename', 260).notNullable()
    table.string('file_hash', 64).notNullable()
    table.integer('rows_total').notNullable()
    table.integer('imported').notNullable()
    table.integer('skipped').notNullable()
    table.text('report_json').notNullable()
    table.string('created_at', 40).notNullable()
    table.index('file_hash')
  })

  await knex.schema.createTable('enrollments', (table) => {
    table.increments('id').primary()
    table
      .integer('student_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('students')
      .onDelete('CASCADE')
    table.string('cohort', 100).notNullable()
    table.string('plan_type', 200).notNullable()
    table.string('sub_plan_type', 200).nullable()
    table.string('course_type', 40).notNullable()
    table.string('cohort_start_date', 10).notNullable()
    table.string('enrolled_at', 10).notNullable()
    table.string('access_expiry_date', 10).notNullable()
    // Platform-reported value. Never recomputed as a module average.
    table.float('overall_progress_pct').notNullable()
    table.string('progress_updated_at', 10).notNullable()
    table
      .integer('import_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('imports')
      .onDelete('SET NULL')
    table.unique(['student_id', 'cohort'])
    table.index('cohort')
  })

  await knex.schema.createTable('module_progress', (table) => {
    table.increments('id').primary()
    table
      .integer('enrollment_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('enrollments')
      .onDelete('CASCADE')
    table
      .integer('module_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('modules')
      .onDelete('CASCADE')
    table.float('progress_pct').notNullable()
    // false = module absent from the student's spreadsheet row (not 0%).
    table.boolean('in_plan').notNullable().defaultTo(true)
    table.string('updated_at', 40).notNullable()
    table.unique(['enrollment_id', 'module_id'])
    table.index('module_id')
  })

  await knex.schema.createTable('skills', (table) => {
    table.increments('id').primary()
    table
      .integer('module_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('modules')
      .onDelete('CASCADE')
    table.string('name', 200).notNullable()
    table.string('importance', 20).notNullable()
    table.float('weight').notNullable()
    table.text('prereq_skill_ids').notNullable().defaultTo('[]')
    table.text('activity_templates').notNullable().defaultTo('[]')
    table.unique(['module_id', 'name'])
  })

  await knex.schema.createTable('events', (table) => {
    table.increments('id').primary()
    table
      .integer('student_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('students')
      .onDelete('CASCADE')
    table
      .integer('enrollment_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('enrollments')
      .onDelete('SET NULL')
    table.string('type', 60).notNullable()
    table
      .integer('module_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('modules')
      .onDelete('SET NULL')
    table.text('metadata_json').nullable()
    table.string('created_at', 40).notNullable()
    table.index(['student_id', 'created_at'])
    table.index('type')
  })
}

/** @param {import('knex').Knex} knex */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('events')
  await knex.schema.dropTableIfExists('skills')
  await knex.schema.dropTableIfExists('module_progress')
  await knex.schema.dropTableIfExists('enrollments')
  await knex.schema.dropTableIfExists('imports')
  await knex.schema.dropTableIfExists('modules')
  await knex.schema.dropTableIfExists('students')
}
