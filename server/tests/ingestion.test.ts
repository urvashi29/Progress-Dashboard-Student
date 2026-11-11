import fs from 'node:fs'
import path from 'node:path'
import bcrypt from 'bcryptjs'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Express } from 'express'
import type { Knex } from 'knex'
import {
  bootstrapDatabase,
  prepareTestEnvironment,
} from './helpers/test-workspace'
import {
  buildWorkbook,
  defaultModules,
  expectedCountRows,
  fixtureEmail,
  type FixtureRowInput,
} from './fixtures/workbook'

const workspace = prepareTestEnvironment({ LOGIN_RATE_LIMIT_MAX: '50' })

let db: Knex
let app: Express
let adminAgent: ReturnType<typeof request.agent>
let adminCsrf: string
let nonAdminAgent: ReturnType<typeof request.agent>
let nonAdminCsrf: string
let expectedBuffer: Buffer

async function countRows(table: string, where?: Record<string, unknown>): Promise<number> {
  const query = db(table)
  if (where) query.where(where)
  const rows = await query.count<Array<{ count: number | string }>>({ count: '*' })
  return Number(rows[0]?.count ?? 0)
}

function uploadExcel(agent: ReturnType<typeof request.agent>, csrf: string, buffer: Buffer, filename = 'sanitized.xlsx') {
  return agent
    .post('/api/v1/admin/import/excel')
    .set('x-csrf-token', csrf)
    .attach('file', buffer, {
      filename,
      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
}

async function login(email: string, password: string) {
  const agent = request.agent(app)
  const csrfResponse = await agent.get('/api/v1/auth/csrf')
  const token = csrfResponse.body.csrfToken as string
  const response = await agent
    .post('/api/v1/auth/login')
    .set('x-csrf-token', token)
    .send({ email, password })
  return { agent, csrf: response.body.csrfToken as string, response }
}

beforeAll(async () => {
  db = await bootstrapDatabase()
  const now = new Date().toISOString()

  await db('students').insert({
    name: 'Fictional Admin',
    email: process.env.ADMIN_EMAIL,
    password_hash: await bcrypt.hash('AdminPassw0rd!', 4),
    must_change_password: false,
    role: 'admin',
    created_at: now,
  })
  await db('students').insert({
    name: 'Fictional Regular Student',
    email: 'regular.student@example.com',
    password_hash: await bcrypt.hash('StudentPassw0rd!', 4),
    must_change_password: false,
    role: 'student',
    created_at: now,
  })

  const { createApp } = await import('../src/app')
  app = createApp()

  const admin = await login(process.env.ADMIN_EMAIL as string, 'AdminPassw0rd!')
  expect(admin.response.status).toBe(200)
  adminAgent = admin.agent
  adminCsrf = admin.csrf

  const nonAdmin = await login('regular.student@example.com', 'StudentPassw0rd!')
  expect(nonAdmin.response.status).toBe(200)
  nonAdminAgent = nonAdmin.agent
  nonAdminCsrf = nonAdmin.csrf

  expectedBuffer = await buildWorkbook(expectedCountRows())
})

afterAll(async () => {
  if (db) await db.destroy()
  workspace.cleanup()
})

describe.sequential('Excel ingestion', () => {
  it('imports the sanitized 173-row fixture with the audited counts', async () => {
    const response = await uploadExcel(adminAgent, adminCsrf, expectedBuffer)
    expect(response.status).toBe(201)

    const report = response.body
    expect(report.rowsTotal).toBe(173)
    expect(report.imported).toBe(170)
    expect(report.skippedTotal).toBe(3)
    expect(report.skippedByReason).toEqual({ empty_row: 1, non_data_science: 2 })
    expect(report.duplicateEmails).toHaveLength(2)
    expect(report.unknownModules).toHaveLength(0)
    expect(report.validationFailures).toHaveLength(0)
    expect(
      report.warnings.filter((warning: { code: string }) => warning.code === 'missing_overall_progress'),
    ).toHaveLength(8)
    expect(report.createdStudents).toBe(170)
    expect(report.createdEnrollments).toBe(170)
    expect(report.moduleProgressRows).toBe(170 * 13)

    expect(await countRows('enrollments')).toBe(170)
    expect(await countRows('module_progress')).toBe(170 * 13)
    expect(await countRows('students', { email: fixtureEmail(1) })).toBe(1)

    const credentialsFile = path.join(workspace.privateDir, 'credentials.csv')
    expect(fs.existsSync(credentialsFile)).toBe(true)
    expect(fs.readFileSync(credentialsFile, 'utf8').trim().split(/\r?\n/)).toHaveLength(171)

    const importsDir = path.join(workspace.privateDir, 'imports')
    const archived = fs.readdirSync(importsDir)
    expect(archived).toHaveLength(1)
    expect(archived[0]).not.toContain('..')
  })

  it('is idempotent when the same file is imported again', async () => {
    const before = await countRows('students')
    const response = await uploadExcel(adminAgent, adminCsrf, expectedBuffer)
    expect(response.status).toBe(200)
    expect(response.body.alreadyImported).toBe(true)
    expect(response.body.imported).toBe(170)

    expect(await countRows('imports')).toBe(1)
    expect(await countRows('students')).toBe(before)
  })

  it('maps reordered modules by name and keeps absent modules out of plan', async () => {
    const reordered = await db('students').where({ email: fixtureEmail(3) }).first<{ id: number }>('id')
    const reorderedEnrollment = await db('enrollments')
      .where({ student_id: reordered?.id })
      .first<{ id: number }>('id')

    const progressFor = async (slug: string): Promise<{ progress_pct: number; in_plan: number } | undefined> =>
      db('module_progress')
        .join('modules', 'modules.id', 'module_progress.module_id')
        .where({ enrollment_id: reorderedEnrollment?.id, slug })
        .first<{ progress_pct: number; in_plan: number }>('progress_pct', 'in_plan')

    expect((await progressFor('intro-to-computer-programming'))?.progress_pct).toBe(95)
    expect((await progressFor('relational-databases'))?.progress_pct).toBe(45)

    const partial = await db('students').where({ email: fixtureEmail(2) }).first<{ id: number }>('id')
    const partialEnrollment = await db('enrollments')
      .where({ student_id: partial?.id })
      .first<{ id: number }>('id')
    const partialRows = await db('module_progress')
      .join('modules', 'modules.id', 'module_progress.module_id')
      .where({ enrollment_id: partialEnrollment?.id })
      .select<Array<{ slug: string; in_plan: number; progress_pct: number }>>(
        'slug',
        'in_plan',
        'progress_pct',
      )

    const absent = new Set(
      partialRows.filter((row) => !Boolean(row.in_plan)).map((row) => row.slug),
    )
    expect(absent).toEqual(
      new Set([
        'intro-to-deep-learning',
        'dl-for-computer-vision',
        'dl-for-nlp',
        'industry-immersion',
      ]),
    )
    for (const row of partialRows) {
      if (!row.in_plan) expect(row.progress_pct).toBe(0)
    }

    const twelve = await db('students').where({ email: fixtureEmail(1) }).first<{ id: number }>('id')
    const twelveEnrollment = await db('enrollments')
      .where({ student_id: twelve?.id })
      .first<{ id: number }>('id')
    const industry = await db('module_progress')
      .join('modules', 'modules.id', 'module_progress.module_id')
      .where({ enrollment_id: twelveEnrollment?.id, slug: 'industry-immersion' })
      .first<{ in_plan: number }>('in_plan')
    expect(Boolean(industry?.in_plan)).toBe(false)
  })

  it('preserves platform overall progress and stores blank overall as NULL', async () => {
    const preserved = await db('students').where({ email: fixtureEmail(11) }).first<{ id: number }>('id')
    const preservedEnrollment = await db('enrollments')
      .where({ student_id: preserved?.id })
      .first<{ overall_progress_pct: number | null }>('overall_progress_pct')
    expect(preservedEnrollment?.overall_progress_pct).toBe(70)

    const blank = await db('students').where({ email: fixtureEmail(1) }).first<{ id: number }>('id')
    const blankEnrollment = await db('enrollments')
      .where({ student_id: blank?.id })
      .first<{ overall_progress_pct: number | null }>('overall_progress_pct')
    expect(blankEnrollment?.overall_progress_pct).toBeNull()
  })

  it('reports unknown module names without failing the row', async () => {
    const modules = defaultModules()
    modules[0] = { name: 'Mystery Module 9000', progress: 50 }
    const rows: FixtureRowInput[] = [
      {
        name: 'Fictional Unknown Module Student',
        email: 'unknown.module@example.com',
        cohort: 'Cohort UNKNOWN01',
        overall: 33,
        modules,
      },
    ]

    const response = await uploadExcel(
      adminAgent,
      adminCsrf,
      await buildWorkbook(rows),
      'unknown-module.xlsx',
    )
    expect(response.status).toBe(201)
    expect(response.body.imported).toBe(1)
    expect(response.body.unknownModules).toEqual([
      { row: 2, moduleName: 'Mystery Module 9000' },
    ])
    expect(
      response.body.warnings.some(
        (warning: { code: string }) => warning.code === 'unknown_module',
      ),
    ).toBe(true)

    const student = await db('students')
      .where({ email: 'unknown.module@example.com' })
      .first<{ id: number }>('id')
    expect(student).toBeTruthy()
    const enrollment = await db('enrollments')
      .where({ student_id: student?.id })
      .first<{ id: number }>('id')
    const replaced = await db('module_progress')
      .join('modules', 'modules.id', 'module_progress.module_id')
      .where({ enrollment_id: enrollment?.id, slug: 'intro-to-computer-programming' })
      .first<{ in_plan: number }>('in_plan')
    expect(Boolean(replaced?.in_plan)).toBe(false)
  })

  it('reports invalid dates and percentages and does not invent values', async () => {
    const invalidProgress = defaultModules()
    invalidProgress[0] = { name: invalidProgress[0]?.name ?? 'Relational Databases', progress: 150 }

    const rows: FixtureRowInput[] = [
      {
        name: 'Fictional Bad Date',
        email: 'invalid.date@example.com',
        cohort: 'Cohort BADDATE',
        cohortStartDate: 'not-a-date',
      },
      {
        name: 'Fictional Bad Progress',
        email: 'invalid.progress@example.com',
        cohort: 'Cohort BADPROGRESS',
        modules: invalidProgress,
      },
      {
        name: 'Fictional Bad Overall',
        email: 'invalid.overall@example.com',
        cohort: 'Cohort BADOVERALL',
        overall: 'abc',
      },
    ]

    const response = await uploadExcel(
      adminAgent,
      adminCsrf,
      await buildWorkbook(rows),
      'invalid-values.xlsx',
    )
    expect(response.status).toBe(201)
    expect(response.body.imported).toBe(1)
    expect(response.body.skippedByReason).toEqual({ validation_failed: 2 })
    expect(
      response.body.validationFailures.map((failure: { field: string }) => failure.field),
    ).toEqual(expect.arrayContaining(['cohort_start_date_raw', 'M1 progress %']))
    expect(
      response.body.warnings.some(
        (warning: { code: string }) => warning.code === 'invalid_overall_progress',
      ),
    ).toBe(true)

    expect(await countRows('students', { email: 'invalid.date@example.com' })).toBe(0)
    expect(await countRows('students', { email: 'invalid.progress@example.com' })).toBe(0)

    const stored = await db('students')
      .where({ email: 'invalid.overall@example.com' })
      .first<{ id: number }>('id')
    const enrollment = await db('enrollments')
      .where({ student_id: stored?.id })
      .first<{ overall_progress_pct: number | null }>('overall_progress_pct')
    expect(enrollment?.overall_progress_pct).toBeNull()
  })

  it('rejects missing, wrong-type, and spoofed uploads', async () => {
    const missing = await adminAgent
      .post('/api/v1/admin/import/excel')
      .set('x-csrf-token', adminCsrf)
    expect(missing.status).toBe(400)
    expect(missing.body.error).toBe('missing_file')

    const wrongType = await adminAgent
      .post('/api/v1/admin/import/excel')
      .set('x-csrf-token', adminCsrf)
      .attach('file', Buffer.from('not a workbook'), {
        filename: 'notes.txt',
        contentType: 'text/plain',
      })
    expect(wrongType.status).toBe(400)
    expect(wrongType.body.error).toBe('unsupported_file_type')

    const spoofed = await adminAgent
      .post('/api/v1/admin/import/excel')
      .set('x-csrf-token', adminCsrf)
      .attach('file', Buffer.from('not a zip container at all'), {
        filename: 'spoofed.xlsx',
        contentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
    expect(spoofed.status).toBe(400)
    expect(spoofed.body.error).toBe('invalid_file_signature')
  })

  it('sanitizes an uploaded filename and keeps files inside the private directory', async () => {
    const rows: FixtureRowInput[] = [
      {
        name: 'Fictional Traversal Student',
        email: 'traversal@example.com',
        cohort: 'Cohort TRAVERSAL',
        overall: 12,
      },
    ]
    const response = await uploadExcel(
      adminAgent,
      adminCsrf,
      await buildWorkbook(rows),
      '../../escape.xlsx',
    )
    expect(response.status).toBe(201)

    expect(fs.existsSync(path.join(workspace.dir, 'escape.xlsx'))).toBe(false)
    const importsDir = path.join(workspace.privateDir, 'imports')
    for (const filename of fs.readdirSync(importsDir)) {
      expect(filename).not.toContain('..')
      expect(path.resolve(importsDir, filename).startsWith(path.resolve(importsDir))).toBe(true)
    }
  })
})

describe.sequential('import authorization', () => {
  it('rejects unauthenticated imports', async () => {
    const response = await request(app)
      .post('/api/v1/admin/import/excel')
      .attach('file', expectedBuffer, {
        filename: 'sanitized.xlsx',
        contentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
    expect(response.status).toBe(401)
    expect(response.body.error).toBe('unauthorized')
  })

  it('rejects non-admin imports', async () => {
    const response = await uploadExcel(
      nonAdminAgent,
      nonAdminCsrf,
      await buildWorkbook([
        {
          name: 'Fictional Non Admin',
          email: 'non.admin.upload@example.com',
          cohort: 'Cohort NONADMIN',
        },
      ]),
    )
    expect(response.status).toBe(403)
    expect(response.body.error).toBe('forbidden')
  })

  it('rejects admin imports without a CSRF token', async () => {
    const response = await adminAgent
      .post('/api/v1/admin/import/excel')
      .attach('file', expectedBuffer, {
        filename: 'sanitized.xlsx',
        contentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
    expect(response.status).toBe(403)
    expect(response.body.error).toBe('invalid_csrf_token')
  })
})
