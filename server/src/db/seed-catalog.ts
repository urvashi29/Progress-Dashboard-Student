import { MODULES, type CatalogModule } from '@spd/shared'
import type { Knex } from 'knex'
import { db } from './client'

/**
 * Idempotent catalog upsert shared by the seed script and tests. Returns a
 * slug -> database id map for module progress writes.
 */
export async function seedCatalog(client: Knex = db): Promise<Map<string, number>> {
  for (const entry of MODULES) {
    await client('modules')
      .insert({
        slug: entry.slug,
        name: entry.name,
        normalized_name: entry.normalizedName,
        track: entry.track,
        catalog_order: entry.catalogOrder,
      })
      .onConflict('slug')
      .merge(['name', 'normalized_name', 'track', 'catalog_order'])
  }

  const rows = await client('modules').select<Array<{ id: number; slug: string }>>('id', 'slug')
  const idBySlug = new Map(rows.map((row) => [row.slug, row.id]))

  for (const entry of MODULES as readonly CatalogModule[]) {
    const moduleId = idBySlug.get(entry.slug)
    if (!moduleId) throw new Error(`Seeded module missing after insert: ${entry.slug}`)

    for (const skill of entry.skills) {
      await client('skills')
        .insert({
          module_id: moduleId,
          name: skill.name,
          importance: skill.importance,
          weight: skill.weight,
          // Skill-level prerequisites are resolved in Phase 4. Module-level
          // prerequisites live in the catalog constant.
          prereq_skill_ids: JSON.stringify([]),
          activity_templates: JSON.stringify(skill.activityTemplates),
        })
        .onConflict(['module_id', 'name'])
        .merge(['importance', 'weight', 'prereq_skill_ids', 'activity_templates'])
    }
  }

  return idBySlug
}
