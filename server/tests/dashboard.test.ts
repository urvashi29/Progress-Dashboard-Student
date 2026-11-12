import { DashboardResponseSchema, MODULES, getMockEnrollment } from '@spd/shared'
import { describe, expect, it } from 'vitest'
import { createFixtureRepositories } from '../src/repositories/fixture'
import {
  buildDashboard,
  buildDashboardModules,
  buildTrackRollups,
} from '../src/services/dashboard'

const NOW = new Date('2026-02-04T09:00:00+05:30')

async function loadStudentOne() {
  const repositories = createFixtureRepositories()
  const student = await repositories.students.getStudentProfile(1)
  const enrollment = await repositories.enrollments.getCurrentEnrollment(1)
  if (!student || !enrollment) throw new Error('fixture student 1 is incomplete')
  const moduleProgress = await repositories.moduleProgress.listModuleProgress(enrollment.id)
  return { student, enrollment, moduleProgress }
}

describe('dashboard assembly', () => {
  it('validates against the shared dashboard contract', async () => {
    const input = await loadStudentOne()
    const dashboard = buildDashboard({ ...input, now: NOW })
    expect(() => DashboardResponseSchema.parse(dashboard)).not.toThrow()
    expect(dashboard.generatedAt).toBe('2026-02-04T03:30:00.000Z')
  })

  it('preserves the platform overall progress instead of averaging modules', async () => {
    const input = await loadStudentOne()
    const dashboard = buildDashboard({ ...input, now: NOW })

    expect(dashboard.overallProgressPct).toBe(34)
    expect(dashboard.progressComparison.moduleAveragePct).toBe(25.9)
    expect(dashboard.progressComparison.differenceFromOverallPct).toBe(-8.1)
    expect(dashboard.progressComparison.note).toContain('not the overall progress')
  })

  it('returns all 13 modules in curated catalog order', async () => {
    const input = await loadStudentOne()
    const dashboard = buildDashboard({ ...input, now: NOW })

    expect(dashboard.modules).toHaveLength(13)
    expect(dashboard.modules.map((entry) => entry.moduleSlug)).toEqual(
      MODULES.map((entry) => entry.slug),
    )
    expect(dashboard.modules.map((entry) => entry.catalogOrder)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13,
    ])
  })

  it('builds unweighted track rollups over in-plan modules only', async () => {
    const input = await loadStudentOne()
    const dashboard = buildDashboard({ ...input, now: NOW })

    expect(dashboard.tracks).toEqual([
      {
        track: 'foundations',
        name: 'Foundations',
        moduleCount: 3,
        inPlanCount: 3,
        averageProgressPct: 71.7,
      },
      {
        track: 'data-analytics',
        name: 'Data & Analytics',
        moduleCount: 2,
        inPlanCount: 2,
        averageProgressPct: 20,
      },
      {
        track: 'ai-ml',
        name: 'AI & ML',
        moduleCount: 6,
        inPlanCount: 5,
        averageProgressPct: 6,
      },
      {
        track: 'production-industry',
        name: 'Production & Industry',
        moduleCount: 2,
        inPlanCount: 1,
        averageProgressPct: 0,
      },
    ])
  })

  it('classifies module completion bands accurately', async () => {
    const input = await loadStudentOne()
    const modules = buildDashboardModules({ ...input, now: NOW })
    const bySlug = new Map(modules.map((entry) => [entry.moduleSlug, entry]))

    expect(bySlug.get('intro-to-computer-programming')?.band).toBe('STRONG')
    expect(bySlug.get('numerical-programming-in-python')?.band).toBe('STRONG')
    expect(bySlug.get('relational-databases')?.band).toBe('NEEDS_ATTENTION')
    expect(bySlug.get('ml-genai-with-microsoft-azure')?.band).toBe('NEEDS_ATTENTION')
    expect(bySlug.get('dl-for-nlp')?.band).toBe('NOT_STARTED')
    expect(bySlug.get('productionization-of-ml-systems')?.band).toBe('NOT_STARTED')
    expect(bySlug.get('distributed-ml')?.band).toBe('NOT_IN_PLAN')
    expect(bySlug.get('industry-immersion')?.band).toBe('NOT_IN_PLAN')
  })

  it('derives pace-aware health from enrollment dates and the injected clock', async () => {
    const input = await loadStudentOne()
    const dashboard = buildDashboard({ ...input, now: NOW })

    expect(dashboard.health.expectedPct).toBe(68.5)
    expect(dashboard.health.paceRatio).toBe(0.496)
    expect(dashboard.health.staleDays).toBe(46)
    expect(dashboard.health.status).toBe('CRITICAL')
    expect(dashboard.health.downgraded).toBe(true)
  })

  it('provides an empty, non-invented coach placeholder', async () => {
    const input = await loadStudentOne()
    const dashboard = buildDashboard({ ...input, now: NOW })

    expect(dashboard.coachSummary.recommendations).toEqual([])
    expect(dashboard.coachSummary.headline).toContain('not available yet')
  })
})

describe('absent modules versus real zero progress', () => {
  it('synthesizes all catalog modules and marks missing rows NOT_IN_PLAN', () => {
    const enrollment = getMockEnrollment(1)
    const modules = buildDashboardModules({
      enrollment,
      moduleProgress: [
        {
          enrollmentId: 1,
          moduleSlug: 'intro-to-computer-programming',
          progressPct: 100,
          inPlan: true,
          updatedAt: '2025-12-20',
        },
      ],
      now: NOW,
    })

    expect(modules).toHaveLength(13)

    const present = modules.find(
      (entry) => entry.moduleSlug === 'intro-to-computer-programming',
    )
    expect(present).toMatchObject({ inPlan: true, progressPct: 100, band: 'STRONG' })

    const absent = modules.find((entry) => entry.moduleSlug === 'relational-databases')
    expect(absent).toMatchObject({ inPlan: false, progressPct: 0, band: 'NOT_IN_PLAN' })
    expect(absent?.updatedAt).toBe(enrollment.progressUpdatedAt)
  })

  it('keeps an in-plan 0% module as NOT_STARTED', () => {
    const enrollment = getMockEnrollment(1)
    const modules = buildDashboardModules({
      enrollment,
      moduleProgress: [
        {
          enrollmentId: 1,
          moduleSlug: 'relational-databases',
          progressPct: 0,
          inPlan: true,
          updatedAt: '2025-12-20',
        },
      ],
      now: NOW,
    })

    const zero = modules.find((entry) => entry.moduleSlug === 'relational-databases')
    expect(zero).toMatchObject({ inPlan: true, progressPct: 0, band: 'NOT_STARTED' })
  })

  it('treats a not-in-plan row differently from an in-plan zero', () => {
    const enrollment = getMockEnrollment(1)
    const modules = buildDashboardModules({
      enrollment,
      moduleProgress: [
        {
          enrollmentId: 1,
          moduleSlug: 'relational-databases',
          progressPct: 0,
          inPlan: false,
          updatedAt: '2025-12-20',
        },
      ],
      now: NOW,
    })

    const module = modules.find((entry) => entry.moduleSlug === 'relational-databases')
    expect(module).toMatchObject({ inPlan: false, band: 'NOT_IN_PLAN' })
  })
})

describe('track rollups', () => {
  it('returns null averages when no module in a track is in plan', () => {
    const enrollment = getMockEnrollment(1)
    const modules = buildDashboardModules({
      enrollment,
      moduleProgress: [],
      now: NOW,
    })
    const rollups = buildTrackRollups(modules)

    expect(rollups).toHaveLength(4)
    for (const rollup of rollups) {
      expect(rollup.inPlanCount).toBe(0)
      expect(rollup.averageProgressPct).toBeNull()
    }
  })

  it('does not let the module average masquerade as overall progress', async () => {
    const input = await loadStudentOne()
    const dashboard = buildDashboard({ ...input, now: NOW })
    expect(dashboard.overallProgressPct).toBe(input.enrollment.overallProgressPct)
    expect(dashboard.progressComparison.moduleAveragePct).not.toBe(
      dashboard.overallProgressPct,
    )
  })
})
