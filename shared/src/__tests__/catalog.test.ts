import { describe, expect, it } from 'vitest'
import {
  CATALOG_NOTE,
  MODULES,
  TRACKS,
  buildCatalogResponse,
  findModuleByName,
  getModulesByTrack,
  normalizeModuleName,
} from '../catalog'
import { CatalogResponseSchema } from '../modules'

describe('module catalog', () => {
  it('has exactly 13 modules across the 4 approved tracks', () => {
    expect(MODULES).toHaveLength(13)
    expect(TRACKS.map((track) => track.name)).toEqual([
      'Foundations',
      'Data & Analytics',
      'AI & ML',
      'Production & Industry',
    ])
    expect(getModulesByTrack('foundations')).toHaveLength(3)
    expect(getModulesByTrack('data-analytics')).toHaveLength(2)
    expect(getModulesByTrack('ai-ml')).toHaveLength(6)
    expect(getModulesByTrack('production-industry')).toHaveLength(2)
  })

  it('uses unique catalog positions 1..13', () => {
    const orders = MODULES.map((entry) => entry.catalogOrder).sort((a, b) => a - b)
    expect(orders).toEqual(Array.from({ length: 13 }, (_value, index) => index + 1))
  })

  it('maps modules by normalized name, never by position', () => {
    expect(findModuleByName('  dL for   NLP ')?.slug).toBe('dl-for-nlp')
    expect(findModuleByName('RELATIONAL DATABASES')?.slug).toBe('relational-databases')
    expect(findModuleByName('Intro to Deep Learning')?.slug).toBe('intro-to-deep-learning')
    expect(findModuleByName('not an approved module')).toBeUndefined()
    expect(normalizeModuleName('  ML & GenAI   with Microsoft Azure ')).toBe(
      'ml & genai with microsoft azure',
    )
  })

  it('keeps slug, normalized name, and track references consistent', () => {
    const normalizedNames = MODULES.map((entry) => entry.normalizedName)
    expect(new Set(normalizedNames).size).toBe(MODULES.length)
    expect(new Set(MODULES.map((entry) => entry.slug)).size).toBe(MODULES.length)

    const trackSlugs = new Set(TRACKS.map((track) => track.slug))
    for (const entry of MODULES) {
      expect(trackSlugs.has(entry.track)).toBe(true)
      expect(entry.normalizedName).toBe(normalizeModuleName(entry.name))
      expect(entry.skills.length).toBeGreaterThanOrEqual(3)
    }
  })

  it('references only catalog modules as prerequisites', () => {
    const slugs = new Set(MODULES.map((entry) => entry.slug))
    for (const entry of MODULES) {
      for (const prerequisite of entry.prerequisiteModuleSlugs) {
        expect(slugs.has(prerequisite)).toBe(true)
        expect(prerequisite).not.toBe(entry.slug)
      }
    }
  })

  it('marks every skill as estimated and keeps weights normalized', () => {
    for (const entry of MODULES) {
      const totalWeight = entry.skills.reduce((total, skill) => total + skill.weight, 0)
      expect(totalWeight).toBeCloseTo(1, 5)
      for (const skill of entry.skills) {
        expect(skill.estimated).toBe(true)
        expect(skill.confidence).toBe('low')
        expect(skill.activityTemplates.length).toBeGreaterThan(0)
      }
    }
  })

  it('builds a catalog response that satisfies the shared contract', () => {
    const response = CatalogResponseSchema.parse(buildCatalogResponse())
    expect(response.skillsAreEstimated).toBe(true)
    expect(response.note).toBe(CATALOG_NOTE)
    expect(response.note).toMatch(/estimated/i)
    expect(response.modules).toHaveLength(13)
  })
})
