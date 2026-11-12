import {
  CareerPathDetailResponseSchema,
  CareerPathListResponseSchema,
  SkillListResponseSchema,
  SkillographyResponseSchema,
  getMockEnrollment,
  getMockStudent,
  type Enrollment,
  type ModuleProgressRecord,
  type Student,
} from '@spd/shared'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp, type CreateAppOptions } from '../src/app'
import { createFixtureRepositories, type FixtureDataset } from '../src/repositories/fixture'

const NOW = new Date('2026-02-04T09:00:00+05:30')

function testApp(
  options: { dataset?: FixtureDataset; studentId?: number | null } = {},
) {
  const appOptions: CreateAppOptions = {
    repositories: createFixtureRepositories(options.dataset),
    clock: { now: () => NOW },
    identityResolver: () => options.studentId ?? null,
    timeZone: 'Asia/Kolkata',
  }
  return createApp(appOptions)
}

function dataset(
  records: ModuleProgressRecord[],
  students: Student[] = [getMockStudent(1)],
  enrollments: Enrollment[] = [getMockEnrollment(1)],
): FixtureDataset {
  return { students, enrollments, moduleProgress: records }
}

function progress(
  moduleSlug: string,
  progressPct: number,
  inPlan = true,
  enrollmentId = 1,
): ModuleProgressRecord {
  return {
    enrollmentId,
    moduleSlug,
    progressPct,
    inPlan,
    updatedAt: '2025-12-20',
  }
}

describe('GET /api/v1/me/skills', () => {
  it('returns estimated skills for the authenticated student', async () => {
    const response = await request(testApp({ studentId: 1 })).get('/api/v1/me/skills')

    expect(response.status).toBe(200)
    const body = SkillListResponseSchema.parse(response.body)
    expect(body.skills.length).toBeGreaterThan(0)
    expect(body.skillsAreEstimated).toBe(true)
    expect(body.proficiencyAvailable).toBe(false)
    expect(body.methodology).toMatch(/not measured proficiency|progress-weighted/i)
    expect(body.skills.every((skill) => skill.confidence === 'low')).toBe(true)
    expect(body.skills.every((skill) => skill.limitation.length > 0)).toBe(true)
  })

  it('combines repeated skills across modules with catalog weights', async () => {
    const response = await request(
      testApp({
        studentId: 1,
        dataset: dataset([
          progress('numerical-programming-in-python', 60),
          progress('data-visualization-tools', 20),
        ]),
      }),
    ).get('/api/v1/me/skills')

    const body = SkillListResponseSchema.parse(response.body)
    const skill = body.skills.find((entry) => entry.skillId === 'data-wrangling')
    expect(skill).toBeDefined()
    expect(skill?.moduleAssociations.map((entry) => entry.moduleSlug)).toEqual([
      'numerical-programming-in-python',
      'data-visualization-tools',
    ])
    expect(skill?.evidenceSources).toHaveLength(2)
    // (0.25 * 60 + 0.15 * 20) / (0.25 + 0.15) = 45
    expect(skill?.estimatedExposurePct).toBe(45)
    expect(skill?.status).toBe('IN_PROGRESS')
  })

  it('excludes modules outside the plan instead of treating them as 0%', async () => {
    const response = await request(
      testApp({
        studentId: 1,
        dataset: dataset([
          progress('numerical-programming-in-python', 100),
          progress('data-visualization-tools', 0, false),
        ]),
      }),
    ).get('/api/v1/me/skills')

    const body = SkillListResponseSchema.parse(response.body)
    const skill = body.skills.find((entry) => entry.skillId === 'data-wrangling')
    expect(skill?.estimatedExposurePct).toBe(100)
    expect(skill?.evidenceSources.map((entry) => entry.moduleSlug)).toEqual([
      'numerical-programming-in-python',
    ])
    const excluded = skill?.moduleAssociations.find(
      (entry) => entry.moduleSlug === 'data-visualization-tools',
    )
    expect(excluded).toMatchObject({ inPlan: false, progressPct: null, contributionPct: 0 })
  })

  it('distinguishes an in-plan 0% module from a module outside the plan', async () => {
    const response = await request(
      testApp({
        studentId: 1,
        dataset: dataset([progress('relational-databases', 0)]),
      }),
    ).get('/api/v1/me/skills')

    const body = SkillListResponseSchema.parse(response.body)
    const zero = body.skills.find((entry) => entry.skillId === 'sql-joins')
    const absent = body.skills.find((entry) => entry.skillId === 'data-parallelism')

    expect(zero).toMatchObject({ estimatedExposurePct: 0, status: 'NOT_STARTED' })
    expect(absent).toMatchObject({ estimatedExposurePct: null, status: 'NOT_IN_PLAN' })
    expect(absent?.evidenceSources).toHaveLength(0)
  })

  it('handles an in-plan module with unusable progress as unavailable', async () => {
    const response = await request(
      testApp({
        studentId: 1,
        dataset: dataset([progress('intro-to-deep-learning', Number.NaN)]),
      }),
    ).get('/api/v1/me/skills')

    const body = SkillListResponseSchema.parse(response.body)
    const skill = body.skills.find((entry) => entry.skillId === 'neural-network-basics')
    expect(skill?.estimatedExposurePct).toBeNull()
    expect(skill?.status).toBe('UNAVAILABLE')
    expect(skill?.moduleAssociations[0]?.progressAvailable).toBe(false)
  })

  it('rejects unauthenticated requests and ignores arbitrary student ids', async () => {
    const unauthenticated = await request(testApp({ studentId: null })).get('/api/v1/me/skills')
    expect(unauthenticated.status).toBe(401)

    const authenticated = await request(
      testApp({ studentId: 1, dataset: dataset([progress('intro-to-computer-programming', 100)]) }),
    ).get('/api/v1/me/skills?studentId=2')
    expect(authenticated.status).toBe(200)
    const body = SkillListResponseSchema.parse(authenticated.body)
    expect(
      body.skills.find((entry) => entry.skillId === 'programming-fundamentals')
        ?.estimatedExposurePct,
    ).toBe(100)
  })

  it('isolates two students with separate progress', async () => {
    const twoStudents = dataset(
      [
        progress('intro-to-computer-programming', 100, true, 1),
        progress('intro-to-computer-programming', 25, true, 2),
      ],
      [getMockStudent(1), getMockStudent(2)],
      [getMockEnrollment(1), getMockEnrollment(2)],
    )

    const first = SkillListResponseSchema.parse(
      (await request(testApp({ studentId: 1, dataset: twoStudents })).get('/api/v1/me/skills'))
        .body,
    )
    const second = SkillListResponseSchema.parse(
      (await request(testApp({ studentId: 2, dataset: twoStudents })).get('/api/v1/me/skills'))
        .body,
    )

    expect(
      first.skills.find((entry) => entry.skillId === 'programming-fundamentals')
        ?.estimatedExposurePct,
    ).toBe(100)
    expect(
      second.skills.find((entry) => entry.skillId === 'programming-fundamentals')
        ?.estimatedExposurePct,
    ).toBe(25)
  })
})

describe('GET /api/v1/me/skillography', () => {
  it('returns skills, tracks, all 13 modules and their skill mappings', async () => {
    const response = await request(testApp({ studentId: 1 })).get('/api/v1/me/skillography')

    expect(response.status).toBe(200)
    const body = SkillographyResponseSchema.parse(response.body)
    expect(body.student.id).toBe(1)
    expect(body.modules).toHaveLength(13)
    expect(body.tracks).toHaveLength(4)
    expect(body.modules.every((module) => module.skills.length >= 3)).toBe(true)
    expect(body.tracks.reduce((sum, track) => sum + track.skillCount, 0)).toBe(
      body.skills.length,
    )
    expect(body.practiceAreas.length).toBeGreaterThan(0)
  })
})

describe('career pathway matching', () => {
  it('returns all five pathways as exploration guidance, never job-readiness claims', async () => {
    const response = await request(testApp({ studentId: 1 })).get('/api/v1/me/career-paths')

    expect(response.status).toBe(200)
    const body = CareerPathListResponseSchema.parse(response.body)
    expect(body.careerPaths).toHaveLength(5)
    for (const careerPath of body.careerPaths) {
      expect(careerPath.employmentClaim).toBe(false)
      expect(careerPath.explanation.join(' ')).toMatch(/not a statement that you are job-ready/i)
      expect(careerPath.limitations.length).toBeGreaterThan(0)
      expect(careerPath.pathwayNote).toMatch(/not a guarantee/i)
    }
  })

  it('identifies missing required skills and suggests practice and portfolio evidence', async () => {
    const response = await request(
      testApp({
        studentId: 1,
        dataset: dataset([progress('intro-to-computer-programming', 100)]),
      }),
    ).get('/api/v1/me/career-paths')

    const body = CareerPathListResponseSchema.parse(response.body)
    const pythonPath = body.careerPaths.find(
      (entry) => entry.slug === 'junior-python-developer',
    )
    expect(pythonPath).toBeDefined()
    const missingIds = pythonPath?.missingCompetencies.map((entry) => entry.skillId) ?? []
    expect(missingIds).toContain('python-programming')
    expect(missingIds).toContain('sql-joins')
    expect(missingIds).toContain('schema-design')
    expect(missingIds).not.toContain('programming-fundamentals')
    expect(pythonPath?.estimatedCoveragePct).toBe(40)
    expect(pythonPath?.nextLearningActivities.length).toBeGreaterThan(0)
    expect(pythonPath?.missingCompetencies[0]?.portfolioEvidence.length).toBeGreaterThan(0)
  })

  it('returns pathway detail and a 404 for an unknown slug', async () => {
    const detail = await request(testApp({ studentId: 1 })).get(
      '/api/v1/me/career-paths/junior-data-analyst',
    )
    expect(detail.status).toBe(200)
    const body = CareerPathDetailResponseSchema.parse(detail.body)
    expect(body.careerPath.slug).toBe('junior-data-analyst')
    expect(body.methodology).toMatch(/not professional readiness/i)

    const missing = await request(testApp({ studentId: 1 })).get(
      '/api/v1/me/career-paths/not-a-real-path',
    )
    expect(missing.status).toBe(404)
    expect(missing.body).toMatchObject({ error: 'career_path_not_found' })
  })

  it('requires authentication', async () => {
    const response = await request(testApp({ studentId: null })).get('/api/v1/me/career-paths')
    expect(response.status).toBe(401)
  })
})
