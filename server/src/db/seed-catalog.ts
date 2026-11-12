import {
  CAREER_PATHS,
  MODULES,
  SKILL_CATALOG,
  type CatalogModule,
} from '@spd/shared'
import type { Knex } from 'knex'
import { db } from './client'

/**
 * Idempotent catalog upsert shared by the seed script and tests. Returns a
 * slug -> database id map for module progress writes.
 */
export async function seedCatalog(client: Knex = db): Promise<Map<string, number>> {
  const createdAt = new Date().toISOString()

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
          skill_key: skill.id,
          name: skill.name,
          normalized_name: skill.normalizedName,
          description: skill.description,
          importance: skill.importance,
          weight: skill.weight,
          prereq_skill_ids: JSON.stringify(skill.prereqSkillIds),
          activity_templates: JSON.stringify(skill.activityTemplates),
          portfolio_evidence: JSON.stringify(skill.portfolioEvidence),
        })
        .onConflict(['module_id', 'name'])
        .merge([
          'skill_key',
          'normalized_name',
          'description',
          'importance',
          'weight',
          'prereq_skill_ids',
          'activity_templates',
          'portfolio_evidence',
        ])
    }
  }

  for (const skill of SKILL_CATALOG) {
    await client('skill_catalog')
      .insert({
        skill_key: skill.id,
        name: skill.name,
        normalized_name: skill.normalizedName,
        description: skill.description,
        importance: skill.importance,
        weight: skill.weight,
        prerequisite_skill_ids: JSON.stringify(skill.prerequisiteSkillIds),
        practice_activities: JSON.stringify(skill.practiceActivities),
        portfolio_evidence: JSON.stringify(skill.portfolioEvidence),
        created_at: createdAt,
      })
      .onConflict('skill_key')
      .merge([
        'name',
        'normalized_name',
        'description',
        'importance',
        'weight',
        'prerequisite_skill_ids',
        'practice_activities',
        'portfolio_evidence',
      ])
  }

  for (const careerPath of CAREER_PATHS) {
    await client('career_paths')
      .insert({
        slug: careerPath.slug,
        title: careerPath.title,
        description: careerPath.description,
        required_skill_ids: JSON.stringify(careerPath.requiredSkillIds),
        helpful_skill_ids: JSON.stringify(careerPath.helpfulSkillIds),
        module_slugs: JSON.stringify(careerPath.moduleSlugs),
        suggested_projects: JSON.stringify(careerPath.suggestedProjects),
        portfolio_evidence: JSON.stringify(careerPath.portfolioEvidence),
        pathway_note: careerPath.pathwayNote,
        created_at: createdAt,
      })
      .onConflict('slug')
      .merge([
        'title',
        'description',
        'required_skill_ids',
        'helpful_skill_ids',
        'module_slugs',
        'suggested_projects',
        'portfolio_evidence',
        'pathway_note',
      ])
  }

  return idBySlug
}
