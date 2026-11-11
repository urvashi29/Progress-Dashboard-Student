import {
  DashboardResponseSchema,
  getMockEnrollment,
  getMockStudent,
  type Enrollment,
  type ModuleProgressRecord,
  type Student,
} from '@spd/shared'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp, type CreateAppOptions } from '../src/app'
import {
  ModuleDetailResponseSchema,
  ModuleListResponseSchema,
} from '../src/contracts/module-views'
import { createFixtureRepositories, type FixtureDataset } from '../src/repositories/fixture'

const NOW = new Date('2026-02-04T09:00:00+05:30')

function testApp(options: {
  dataset?: FixtureDataset
  studentId?: number | null
  timeZone?: string
} = {}) {
  const appOptions: CreateAppOptions = {
    repositories: createFixtureRepositories(options.dataset),
    clock: { now: () => NOW },
    identityResolver: () => options.studentId ?? null,
    timeZone: options.timeZone ?? 'Asia/Kolkata',
  }
  return createApp(appOptions)
}

function customDataset(): {
  students: Student[]
  enrollments: Enrollment[]
  moduleProgress: ModuleProgressRecord[]
} {
  return {
    students: [getMockStudent(1), getMockStudent(2)],
    enrollments: [getMockEnrollment(1), getMockEnrollment(2)],
    moduleProgress: [
      {
        enrollmentId: 1,
        moduleSlug: 'intro-to-computer-programming',
        progressPct: 100,
        inPlan: true,
        updatedAt: '2025-12-20',
      },
      {
        enrollmentId: 2,
        moduleSlug: 'intro-to-computer-programming',
        progressPct: 25,
        inPlan: true,
        updatedAt: '2026-01-05',
      },
    ],
  }
}

describe('GET /api/v1/me/dashboard', () => {
  it('returns the authenticated student dashboard and validates the contract', async () => {
    const response = await request(testApp({ studentId: 1 })).get('/api/v1/me/dashboard')

    expect(response.status).toBe(200)
    const dashboard = DashboardResponseSchema.parse(response.body)
    expect(dashboard.student.id).toBe(1)
    expect(dashboard.student.name).toBe('Aanya Fictional')
    expect(dashboard.enrollment.id).toBe(1)
    expect(dashboard.overallProgressPct).toBe(34)
    expect(dashboard.modules).toHaveLength(13)
    expect(dashboard.tracks).toHaveLength(4)
  })

  it('ignores an arbitrary studentId in the query string', async () => {
    const response = await request(testApp({ studentId: 1 })).get(
      '/api/v1/me/dashboard?studentId=2',
    )

    expect(response.status).toBe(200)
    const dashboard = DashboardResponseSchema.parse(response.body)
    expect(dashboard.student.id).toBe(1)
    expect(dashboard.student.name).toBe('Aanya Fictional')
    expect(dashboard.enrollment.overallProgressPct).toBe(34)
  })

  it('isolates students by authenticating each request independently', async () => {
    const app = testApp({ studentId: 1 })
    const otherApp = testApp({ studentId: 2 })

    const first = DashboardResponseSchema.parse(
      (await request(app).get('/api/v1/me/dashboard')).body,
    )
    const second = DashboardResponseSchema.parse(
      (await request(otherApp).get('/api/v1/me/dashboard')).body,
    )

    expect(first.student.id).toBe(1)
    expect(second.student.id).toBe(2)
    expect(first.student.email).not.toBe(second.student.email)
  })

  it('rejects an unauthenticated request with 401', async () => {
    const response = await request(testApp({ studentId: null })).get(
      '/api/v1/me/dashboard',
    )
    expect(response.status).toBe(401)
    expect(response.body).toMatchObject({ error: 'unauthenticated' })
  })

  it('returns 404 when the student has no enrollment', async () => {
    const response = await request(
      testApp({
        studentId: 1,
        dataset: { students: [getMockStudent(1)], enrollments: [], moduleProgress: [] },
      }),
    ).get('/api/v1/me/dashboard')

    expect(response.status).toBe(404)
    expect(response.body).toMatchObject({ error: 'enrollment_not_found' })
  })
})

describe('GET /api/v1/me/modules', () => {
  it('returns all 13 modules in catalog order', async () => {
    const response = await request(testApp({ studentId: 1 })).get('/api/v1/me/modules')

    expect(response.status).toBe(200)
    const list = ModuleListResponseSchema.parse(response.body)
    expect(list.modules).toHaveLength(13)
    expect(list.modules[0]?.moduleSlug).toBe('intro-to-computer-programming')
    expect(list.modules[12]?.moduleSlug).toBe('industry-immersion')
    expect(list.modules.map((entry) => entry.catalogOrder)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13,
    ])
  })
})

describe('GET /api/v1/me/modules/:slug', () => {
  it('returns module identity, skills, activities, and prerequisites', async () => {
    const response = await request(testApp({ studentId: 1 })).get(
      '/api/v1/me/modules/relational-databases',
    )

    expect(response.status).toBe(200)
    const detail = ModuleDetailResponseSchema.parse(response.body)
    expect(detail.module.moduleSlug).toBe('relational-databases')
    expect(detail.module.name).toBe('Relational Databases')
    expect(detail.module.track).toBe('foundations')
    expect(detail.module.catalogOrder).toBe(3)
    expect(detail.skills.length).toBeGreaterThan(0)
    expect(detail.skills.every((skill) => skill.estimated)).toBe(true)
    expect(detail.skillsAreEstimated).toBe(true)
    expect(detail.activities.length).toBeGreaterThan(0)
    expect(detail.activities[0]).toHaveProperty('skill')
    expect(detail.prerequisites.map((entry) => entry.moduleSlug)).toEqual([
      'intro-to-computer-programming',
    ])
    expect(detail.caveat).toContain('estimated')
  })

  it('returns a not-in-plan module without pretending it is started', async () => {
    const response = await request(testApp({ studentId: 1 })).get(
      '/api/v1/me/modules/industry-immersion',
    )

    expect(response.status).toBe(200)
    const detail = ModuleDetailResponseSchema.parse(response.body)
    expect(detail.module.inPlan).toBe(false)
    expect(detail.module.progressPct).toBe(0)
    expect(detail.module.band).toBe('NOT_IN_PLAN')
  })

  it('returns 404 for a module outside the approved catalog', async () => {
    const response = await request(testApp({ studentId: 1 })).get(
      '/api/v1/me/modules/not-a-real-module',
    )

    expect(response.status).toBe(404)
    expect(response.body).toMatchObject({
      error: 'module_not_found',
      slug: 'not-a-real-module',
    })
  })

  it('does not expose a student list or arbitrary student route', async () => {
    const response = await request(testApp({ studentId: 1 })).get('/api/v1/me/students/2')
    expect(response.status).toBe(404)
  })
})

describe('identity isolation with a two-student fixture', () => {
  it('returns only the authenticated student record', async () => {
    const dataset = customDataset()
    const first = DashboardResponseSchema.parse(
      (await request(testApp({ dataset, studentId: 1 })).get('/api/v1/me/dashboard')).body,
    )
    const second = DashboardResponseSchema.parse(
      (
        await request(testApp({ dataset, studentId: 2 })).get(
          '/api/v1/me/dashboard?studentId=1',
        )
      ).body,
    )

    expect(first.student.id).toBe(1)
    expect(first.enrollment.id).toBe(1)
    expect(second.student.id).toBe(2)
    expect(second.enrollment.id).toBe(2)
    expect(second.overallProgressPct).toBe(dataset.enrollments[1]?.overallProgressPct)
    expect(first.modules.find((m) => m.moduleSlug === 'intro-to-computer-programming'))
      .toMatchObject({ progressPct: 100 })
    expect(second.modules.find((m) => m.moduleSlug === 'intro-to-computer-programming'))
      .toMatchObject({ progressPct: 25 })
  })
})
