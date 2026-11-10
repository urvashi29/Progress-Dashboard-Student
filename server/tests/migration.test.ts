import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { Knex } from 'knex'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spd-db-'))
process.env.DB_CLIENT = 'better-sqlite3'
process.env.SQLITE_PATH = path.join(tempDir, 'test.sqlite')

let db: Knex

beforeAll(async () => {
  const clientModule = await import('../src/db/client')
  db = clientModule.db
  await db.migrate.latest()
})

afterAll(async () => {
  await db.destroy()
  fs.rmSync(tempDir, { recursive: true, force: true })
})

async function createStudent(email: string): Promise<number> {
  await db('students').insert({
    name: 'Fictional Test Student',
    email,
    password_hash: null,
    must_change_password: true,
    created_at: new Date().toISOString(),
  })
  const row = await db('students').where({ email }).first<{ id: number } | undefined>('id')
  if (!row) throw new Error('student insert failed')
  return row.id
}

async function createEnrollment(studentId: number): Promise<number> {
  await db('enrollments').insert({
    student_id: studentId,
    cohort: 'TEST-COHORT',
    plan_type: 'Data Science',
    sub_plan_type: null,
    course_type: 'data-science',
    cohort_start_date: '2025-08-01',
    enrolled_at: '2025-08-01',
    access_expiry_date: '2026-05-01',
    overall_progress_pct: 34,
    progress_updated_at: '2025-12-20',
    import_id: null,
  })
  const row = await db('enrollments')
    .where({ student_id: studentId, cohort: 'TEST-COHORT' })
    .first<{ id: number } | undefined>('id')
  if (!row) throw new Error('enrollment insert failed')
  return row.id
}

async function createModule(slug: string): Promise<number> {
  await db('modules').insert({
    slug,
    name: 'Test Module',
    normalized_name: slug,
    track: 'foundations',
    catalog_order: 1,
  })
  const row = await db('modules').where({ slug }).first<{ id: number } | undefined>('id')
  if (!row) throw new Error('module insert failed')
  return row.id
}

describe('Phase 0 database schema', () => {
  it('creates every Phase 0 table', async () => {
    const rows = await db.raw<Array<{ name: string }>>(
      "select name from sqlite_master where type = 'table'",
    )
    const names = rows.map((row) => row.name)
    expect(names).toEqual(
      expect.arrayContaining([
        'students',
        'enrollments',
        'modules',
        'module_progress',
        'skills',
        'events',
        'imports',
      ]),
    )
  })

  it('enforces a unique (enrollment_id, module_id) pair', async () => {
    const studentId = await createStudent('unique@example.com')
    const enrollmentId = await createEnrollment(studentId)
    const moduleId = await createModule('test-unique-module')

    const row = { enrollment_id: enrollmentId, module_id: moduleId, progress_pct: 0, in_plan: false, updated_at: '2025-12-20' }
    await db('module_progress').insert(row)

    await expect(
      db('module_progress').insert({ ...row, progress_pct: 10 }),
    ).rejects.toThrow()

    const stored = await db('module_progress')
      .where({ enrollment_id: enrollmentId, module_id: moduleId })
      .first<{ progress_pct: number; in_plan: number }>()
    expect(stored?.progress_pct).toBe(0)
    expect(Boolean(stored?.in_plan)).toBe(false)
  })

  it('enforces foreign keys on SQLite connections', async () => {
    const moduleId = await createModule('test-fk-module')
    await expect(
      db('module_progress').insert({
        enrollment_id: 999999,
        module_id: moduleId,
        progress_pct: 10,
        in_plan: true,
        updated_at: '2025-12-20',
      }),
    ).rejects.toThrow()
  })
})
