import {
  MODULES,
  MOCK_ENROLLMENTS,
  type ModuleProgressRecord,
} from '@spd/shared'
import { describe, expect, it } from 'vitest'
import { buildDeterministicRecommendations } from '../src/coach/recommendations'

const enrollment = MOCK_ENROLLMENTS[0]!
const catalogSlugs = new Set(MODULES.map((module) => module.slug))

function progress(
  entries: Record<string, { progressPct: number; inPlan: boolean }>,
): ModuleProgressRecord[] {
  return Object.entries(entries).map(([moduleSlug, entry]) => ({
    enrollmentId: enrollment.id,
    moduleSlug,
    progressPct: entry.progressPct,
    inPlan: entry.inPlan,
    updatedAt: '2026-01-15',
  }))
}

function allInPlan(progressPct: number): ModuleProgressRecord[] {
  return progress(
    Object.fromEntries(
      MODULES.map((module) => [module.slug, { progressPct, inPlan: true }]),
    ),
  )
}

function recommend(moduleProgress: ModuleProgressRecord[]) {
  return buildDeterministicRecommendations({ enrollment, moduleProgress })
}

function expectCatalogOnly(recommendations: ReturnType<typeof recommend>): void {
  expect(recommendations.length).toBeLessThanOrEqual(3)
  for (const recommendation of recommendations) {
    expect(catalogSlugs.has(recommendation.moduleSlug)).toBe(true)
    expect(recommendation.estimatedMinutes).toBeNull()
    expect(recommendation.expectedGainPct).toBeNull()
  }
}

describe('deterministic recommendation scenarios', () => {
  it('handles 0% completion without inventing progress or prerequisites', () => {
    const recommendations = recommend(
      progress({
        'intro-to-computer-programming': { progressPct: 0, inPlan: true },
      }),
    )

    expectCatalogOnly(recommendations)
    expect(recommendations).toHaveLength(1)
    expect(recommendations[0]).toMatchObject({
      moduleSlug: 'intro-to-computer-programming',
      type: 'START_MODULE',
      progressPct: 0,
      inPlan: true,
      action: 'VIEW_MODULE',
    })
    expect(recommendations.some((entry) => entry.progressPct > 0)).toBe(false)
  })

  it('handles 30% completion using only approved catalog modules', () => {
    const recommendations = recommend(allInPlan(30))

    expectCatalogOnly(recommendations)
    expect(recommendations).toHaveLength(3)
    expect(recommendations.every((entry) => entry.progressPct === 30)).toBe(true)
    expect(recommendations.every((entry) => entry.inPlan)).toBe(true)
    expect(recommendations[0]?.moduleSlug).toBe('intro-to-computer-programming')
  })

  it('handles 65% completion without fabricating completion', () => {
    const recommendations = recommend(allInPlan(65))

    expectCatalogOnly(recommendations)
    expect(recommendations).toHaveLength(3)
    expect(recommendations.every((entry) => entry.progressPct === 65)).toBe(true)
    expect(recommendations.every((entry) => entry.action === 'CONTINUE_MODULE')).toBe(true)
    expect(recommendations.every((entry) => entry.type !== 'NEAR_FINISH')).toBe(true)
  })

  it('prioritizes near-finish modules at 90% completion', () => {
    const recommendations = recommend(allInPlan(90))

    expectCatalogOnly(recommendations)
    expect(recommendations).toHaveLength(3)
    expect(recommendations.every((entry) => entry.type === 'NEAR_FINISH')).toBe(true)
    expect(recommendations.every((entry) => entry.action === 'CONTINUE_MODULE')).toBe(true)
    expect(recommendations[0]?.moduleSlug).toBe('intro-to-computer-programming')
  })

  it('returns no recommendations when every in-plan module is 100% complete', () => {
    const recommendations = recommend(allInPlan(100))

    expectCatalogOnly(recommendations)
    expect(recommendations).toEqual([])
  })

  it('does not recommend a completed module when another in-plan module is incomplete', () => {
    const recommendations = recommend(
      progress({
        ...Object.fromEntries(
          MODULES.filter((module) => module.slug !== 'numerical-programming-in-python').map(
            (module) => [module.slug, { progressPct: 100, inPlan: true }],
          ),
        ),
        'numerical-programming-in-python': { progressPct: 0, inPlan: true },
      }),
    )

    expectCatalogOnly(recommendations)
    expect(recommendations.map((entry) => entry.moduleSlug)).toEqual([
      'numerical-programming-in-python',
    ])
    expect(recommendations[0]).toMatchObject({
      type: 'START_MODULE',
      progressPct: 0,
      inPlan: true,
    })
  })

  it('treats missing module progress as absent from the plan, not as started', () => {
    const recommendations = recommend(
      progress({
        'intro-to-computer-programming': { progressPct: 100, inPlan: true },
      }),
    )

    expectCatalogOnly(recommendations)
    expect(recommendations).toHaveLength(1)
    expect(recommendations[0]).toMatchObject({
      moduleSlug: 'numerical-programming-in-python',
      type: 'EXPLORE_NEXT',
      progressPct: 0,
      inPlan: false,
      action: 'VIEW_MODULE',
    })
  })

  it('never treats an out-of-plan module as started, near-finish or continuing', () => {
    const recommendations = recommend(
      progress({
        ...Object.fromEntries(
          MODULES.filter((module) => module.slug !== 'numerical-programming-in-python').map(
            (module) => [module.slug, { progressPct: 100, inPlan: true }],
          ),
        ),
        'numerical-programming-in-python': { progressPct: 90, inPlan: false },
      }),
    )

    expectCatalogOnly(recommendations)
    expect(recommendations).toHaveLength(1)
    expect(recommendations[0]).toMatchObject({
      moduleSlug: 'numerical-programming-in-python',
      type: 'EXPLORE_NEXT',
      progressPct: 90,
      inPlan: false,
      action: 'VIEW_MODULE',
    })
  })

  it('never recommends an out-of-plan module whose prerequisites are incomplete', () => {
    const recommendations = recommend(
      progress({
        'advanced-machine-learning': { progressPct: 90, inPlan: false },
      }),
    )

    expectCatalogOnly(recommendations)
    expect(
      recommendations.some(
        (entry) => entry.moduleSlug === 'advanced-machine-learning',
      ),
    ).toBe(false)
  })

  it('uses curriculum/Skillography mappings to explain relevance', () => {
    const recommendations = recommend(allInPlan(90))
    const numerical = recommendations.find(
      (entry) => entry.moduleSlug === 'numerical-programming-in-python',
    )

    expect(numerical).toBeDefined()
    expect(numerical?.skills.map((skill) => skill.name)).toContain('Python programming')
    expect(numerical?.explanation).toContain('Python programming')
    expect(numerical?.reason).toMatch(/90% complete/i)
  })
})
