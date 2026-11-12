import { describe, expect, it } from 'vitest'
import { CAREER_PATHS } from '../careers'
import { MODULES, normalizeSkillName } from '../catalog'
import {
  SKILL_CATALOG,
  SkillCatalogEntrySchema,
  findSkillByName,
  getSkillById,
} from '../skillography'

describe('skillography catalog', () => {
  it('gives every one of the 13 modules three or four curated skills', () => {
    expect(MODULES).toHaveLength(13)
    for (const module of MODULES) {
      expect(module.skills.length).toBeGreaterThanOrEqual(3)
      expect(module.skills.length).toBeLessThanOrEqual(4)
    }
  })

  it('normalizes module weights to 1 and keeps the shared skill catalog valid', () => {
    for (const module of MODULES) {
      const total = module.skills.reduce((sum, skill) => sum + skill.weight, 0)
      expect(total).toBeCloseTo(1, 5)
    }
    const parsed = SkillCatalogEntrySchema.array().parse(SKILL_CATALOG)
    expect(parsed.length).toBeGreaterThan(0)
  })

  it('de-duplicates repeated skills across modules by stable id', () => {
    const ids = SKILL_CATALOG.map((skill) => skill.id)
    expect(new Set(ids).size).toBe(ids.length)

    const dataWrangling = getSkillById('data-wrangling')
    expect(dataWrangling?.moduleAssociations.map((entry) => entry.moduleSlug)).toEqual([
      'numerical-programming-in-python',
      'data-visualization-tools',
    ])

    const modelEvaluation = getSkillById('model-evaluation')
    expect(modelEvaluation?.moduleAssociations.length).toBe(4)

    const python = getSkillById('python-programming')
    expect(python?.moduleAssociations.length).toBe(2)

    const stakeholder = getSkillById('stakeholder-communication')
    expect(stakeholder?.moduleAssociations.length).toBe(2)
  })

  it('uses normalized names and unique stable ids', () => {
    const normalizedNames = SKILL_CATALOG.map((skill) => skill.normalizedName)
    expect(new Set(normalizedNames).size).toBe(normalizedNames.length)
    for (const skill of SKILL_CATALOG) {
      expect(skill.normalizedName).toBe(normalizeSkillName(skill.name))
      expect(skill.description.length).toBeGreaterThan(0)
      expect(skill.estimated).toBe(true)
      expect(skill.confidence).toBe('low')
    }
    expect(findSkillByName('  SQL Joins ')?.id).toBe('sql-joins')
  })

  it('references only known skills as prerequisites', () => {
    const ids = new Set(SKILL_CATALOG.map((skill) => skill.id))
    for (const skill of SKILL_CATALOG) {
      for (const prerequisite of skill.prerequisiteSkillIds) {
        expect(ids.has(prerequisite)).toBe(true)
        expect(prerequisite).not.toBe(skill.id)
      }
    }
  })

  it('describes every career pathway as exploration, not job readiness', () => {
    const skillIds = new Set(SKILL_CATALOG.map((skill) => skill.id))
    const moduleSlugs = new Set(MODULES.map((module) => module.slug))

    for (const careerPath of CAREER_PATHS) {
      expect(careerPath.requiredSkillIds.length).toBeGreaterThan(0)
      for (const skillId of [...careerPath.requiredSkillIds, ...careerPath.helpfulSkillIds]) {
        expect(skillIds.has(skillId)).toBe(true)
      }
      for (const moduleSlug of careerPath.moduleSlugs) {
        expect(moduleSlugs.has(moduleSlug)).toBe(true)
      }
      expect(careerPath.pathwayNote).toMatch(/guarantee|not a statement/i)
      expect(careerPath.suggestedProjects.length).toBeGreaterThan(0)
    }
  })
})
