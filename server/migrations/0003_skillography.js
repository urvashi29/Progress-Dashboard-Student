/**
 * Skillography additions (append-only):
 *  - skills gains a stable catalog key and human-authored metadata
 *  - skill_catalog stores the de-duplicated, cross-module skill catalog
 *  - career_paths stores the editable career-pathway catalog
 *
 * JSON arrays are stored as text, matching the existing skills table. The API
 * reads the typed shared catalog for deterministic, single-query responses;
 * these tables make the catalog inspectable and editable without a deploy.
 */

/** @param {import('knex').Knex} knex */
exports.up = async function up(knex) {
  await knex.schema.alterTable('skills', (table) => {
    table.string('skill_key', 120).nullable()
    table.string('normalized_name', 200).nullable()
    table.text('description').nullable()
    table.text('portfolio_evidence').nullable().defaultTo('[]')
    table.index('skill_key')
  })

  await knex.schema.createTable('skill_catalog', (table) => {
    table.increments('id').primary()
    table.string('skill_key', 120).notNullable().unique()
    table.string('name', 200).notNullable()
    table.string('normalized_name', 200).notNullable().unique()
    table.text('description').notNullable()
    table.string('importance', 20).notNullable()
    table.float('weight').notNullable()
    table.text('prerequisite_skill_ids').notNullable().defaultTo('[]')
    table.text('practice_activities').notNullable().defaultTo('[]')
    table.text('portfolio_evidence').notNullable().defaultTo('[]')
    table.string('created_at', 40).notNullable()
  })

  await knex.schema.createTable('career_paths', (table) => {
    table.increments('id').primary()
    table.string('slug', 120).notNullable().unique()
    table.string('title', 200).notNullable()
    table.text('description').notNullable()
    table.text('required_skill_ids').notNullable().defaultTo('[]')
    table.text('helpful_skill_ids').notNullable().defaultTo('[]')
    table.text('module_slugs').notNullable().defaultTo('[]')
    table.text('suggested_projects').notNullable().defaultTo('[]')
    table.text('portfolio_evidence').notNullable().defaultTo('[]')
    table.text('pathway_note').notNullable()
    table.string('created_at', 40).notNullable()
  })
}

/** @param {import('knex').Knex} knex */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('career_paths')
  await knex.schema.dropTableIfExists('skill_catalog')

  await knex.schema.alterTable('skills', (table) => {
    table.dropIndex('skill_key')
    table.dropColumn('skill_key')
    table.dropColumn('normalized_name')
    table.dropColumn('description')
    table.dropColumn('portfolio_evidence')
  })
}
