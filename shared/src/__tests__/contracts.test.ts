import { describe, expect, it } from 'vitest'
import { DashboardResponseSchema } from '../dashboard'
import { MOCK_DASHBOARD, MOCK_ENROLLMENTS, MOCK_MODULE_PROGRESS, MOCK_STUDENTS } from '../fixtures'
import { HealthAssessmentSchema } from '../health'
import { ModuleProgressSchema, moduleProgressBand } from '../modules'
import { FastPlanSchema } from '../recommendations'

describe('mock fixtures', () => {
  it('uses only fictional identities on the reserved example.com domain', () => {
    for (const student of MOCK_STUDENTS) {
      expect(student.email.endsWith('@example.com')).toBe(true)
      expect(student.name).not.toMatch(/\d{4}/)
    }
    expect(new Set(MOCK_STUDENTS.map((student) => student.email)).size).toBe(MOCK_STUDENTS.length)
  })

  it('keeps platform overall progress authoritative and distinct from the module average', () => {
    const dashboard = DashboardResponseSchema.parse(MOCK_DASHBOARD)
    expect(dashboard.overallProgressPct).toBe(34)
    expect(dashboard.enrollment.overallProgressPct).toBe(dashboard.overallProgressPct)
    expect(dashboard.progressComparison.moduleAveragePct).not.toBe(dashboard.overallProgressPct)
    expect(dashboard.progressComparison.note).toMatch(/platform-reported/i)
    expect(dashboard.progressComparison.note).toMatch(/reference only/i)
  })

  it('orders dashboard modules by catalog order, not fixture position', () => {
    const orders = MOCK_DASHBOARD.modules.map((entry) => entry.catalogOrder)
    expect(orders).toEqual([...orders].sort((a, b) => a - b))
    expect(MOCK_MODULE_PROGRESS[0]?.moduleSlug).toBe('relational-databases')
    expect(MOCK_DASHBOARD.modules[0]?.moduleSlug).toBe('intro-to-computer-programming')
  })

  it('distinguishes an absent module from real 0% progress', () => {
    const absent = MOCK_DASHBOARD.modules.find((entry) => entry.moduleSlug === 'distributed-ml')
    const realZero = MOCK_DASHBOARD.modules.find((entry) => entry.moduleSlug === 'dl-for-nlp')

    expect(absent).toMatchObject({ inPlan: false, progressPct: 0, band: 'NOT_IN_PLAN' })
    expect(realZero).toMatchObject({ inPlan: true, progressPct: 0, band: 'NOT_STARTED' })
    expect(absent?.band).not.toBe(realZero?.band)
  })

  it('validates health reasons and the estimated coach plan contract', () => {
    const health = HealthAssessmentSchema.parse(MOCK_DASHBOARD.health)
    expect(health.reasons.length).toBeGreaterThan(0)
    expect(health.status).toBe('BEHIND')

    const plan = FastPlanSchema.parse({
      module: 'relational-databases',
      currentProgress: 35,
      remaining: 65,
      steps: [
        {
          order: 1,
          skill: 'SQL joins',
          action: 'Practice 12 join queries',
          minutes: 25,
          expectedGainPct: 5,
          why: 'Critical skill · prerequisite for Module 11',
        },
      ],
      totalMinutes: 210,
      projectedCompletionDate: '2026-12-08',
      confidence: 'low',
      caveat: 'Skill mastery is estimated from module progress.',
      estimated: true,
    })
    expect(plan.steps[0]?.skill).toBe('SQL joins')
  })
})

describe('module progress contract', () => {
  it('maps absolute bands and the not-in-plan state', () => {
    expect(moduleProgressBand(100, true)).toBe('STRONG')
    expect(moduleProgressBand(80, true)).toBe('STRONG')
    expect(moduleProgressBand(79, true)).toBe('ON_TRACK')
    expect(moduleProgressBand(50, true)).toBe('ON_TRACK')
    expect(moduleProgressBand(49, true)).toBe('NEEDS_ATTENTION')
    expect(moduleProgressBand(1, true)).toBe('NEEDS_ATTENTION')
    expect(moduleProgressBand(0, true)).toBe('NOT_STARTED')
    expect(moduleProgressBand(100, false)).toBe('NOT_IN_PLAN')
    expect(moduleProgressBand(0, false)).toBe('NOT_IN_PLAN')
  })

  it('rejects a band that contradicts its progress value', () => {
    const result = ModuleProgressSchema.safeParse({
      moduleSlug: 'relational-databases',
      progressPct: 50,
      inPlan: true,
      updatedAt: '2025-12-20',
      band: 'NOT_IN_PLAN',
    })
    expect(result.success).toBe(false)
  })

  it('rejects percentages outside 0..100', () => {
    expect(
      ModuleProgressSchema.safeParse({
        moduleSlug: 'relational-databases',
        progressPct: 120,
        inPlan: true,
        updatedAt: '2025-12-20',
        band: 'STRONG',
      }).success,
    ).toBe(false)
  })

  it('covers all three mock enrollments with 13 records each', () => {
    for (const enrollment of MOCK_ENROLLMENTS) {
      const records = MOCK_MODULE_PROGRESS.filter(
        (record) => record.enrollmentId === enrollment.id,
      )
      expect(records).toHaveLength(13)
      expect(records.some((record) => !record.inPlan)).toBe(
        enrollment.id !== 2,
      )
    }
  })
})
