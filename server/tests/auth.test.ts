import bcrypt from 'bcryptjs'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Express } from 'express'
import type { Knex } from 'knex'
import {
  bootstrapDatabase,
  prepareTestEnvironment,
} from './helpers/test-workspace'

const workspace = prepareTestEnvironment({ LOGIN_RATE_LIMIT_MAX: '5' })

let db: Knex
let app: Express
let studentAId: number
let studentBId: number

const STUDENT_A = { email: 'avery.student@example.com', password: 'AveryPassw0rd!' }
const STUDENT_B = { email: 'blair.student@example.com', password: 'BlairPassw0rd!' }
const ADMIN = { email: 'admin@example.com', password: 'AdminPassw0rd!' }

async function insertStudent(
  name: string,
  email: string,
  password: string,
  role: 'student' | 'admin',
): Promise<number> {
  await db('students').insert({
    name,
    email,
    password_hash: await bcrypt.hash(password, 4),
    must_change_password: false,
    role,
    created_at: new Date().toISOString(),
  })
  const row = await db('students').where({ email }).first<{ id: number }>('id')
  if (!row) throw new Error('student insert failed')
  return row.id
}

async function insertEnrollment(
  studentId: number,
  cohort: string,
  overall: number | null,
): Promise<void> {
  await db('enrollments').insert({
    student_id: studentId,
    cohort,
    plan_type: 'masters',
    sub_plan_type: null,
    course_type: 'data-science',
    cohort_start_date: '2024-12-31',
    enrolled_at: '2025-01-02',
    access_expiry_date: '2026-07-02',
    overall_progress_pct: overall,
    progress_updated_at: '2026-03-13',
    import_id: null,
  })
}

async function csrfFor(agent: ReturnType<typeof request.agent>): Promise<string> {
  const response = await agent.get('/api/v1/auth/csrf')
  expect(response.status).toBe(200)
  return response.body.csrfToken as string
}

async function login(
  agent: ReturnType<typeof request.agent>,
  email: string,
  password: string,
) {
  const token = await csrfFor(agent)
  return agent.post('/api/v1/auth/login').set('x-csrf-token', token).send({ email, password })
}

beforeAll(async () => {
  db = await bootstrapDatabase()
  studentAId = await insertStudent('Fictional Avery', STUDENT_A.email, STUDENT_A.password, 'student')
  studentBId = await insertStudent('Fictional Blair', STUDENT_B.email, STUDENT_B.password, 'student')
  await insertStudent('Fictional Admin', ADMIN.email, ADMIN.password, 'admin')

  await insertEnrollment(studentAId, 'Cohort A-TEST', 40)
  await insertEnrollment(studentBId, 'Cohort B-TEST', 90)

  const { createApp } = await import('../src/app')
  app = createApp()
})

afterAll(async () => {
  if (db) await db.destroy()
  workspace.cleanup()
})

describe('authentication', () => {
  it('rejects unauthenticated access to protected resources', async () => {
    const me = await request(app).get('/api/v1/auth/me')
    expect(me.status).toBe(401)

    const imports = await request(app).get('/api/v1/admin/imports')
    expect(imports.status).toBe(401)
  })

  it('requires a CSRF token to log in', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: STUDENT_A.email, password: STUDENT_A.password })
    expect(response.status).toBe(403)
    expect(response.body.error).toBe('invalid_csrf_token')
  })

  it('returns the same generic error for unknown emails and bad passwords', async () => {
    const agent = request.agent(app)
    const unknown = await login(agent, 'nobody@example.com', 'WrongPassw0rd!')
    const wrong = await login(agent, STUDENT_A.email, 'WrongPassw0rd!')

    expect(unknown.status).toBe(401)
    expect(wrong.status).toBe(401)
    expect(unknown.body).toEqual({ error: 'invalid_credentials' })
    expect(wrong.body).toEqual({ error: 'invalid_credentials' })
  })

  it('logs in with an HttpOnly cookie and only that student enrollment', async () => {
    const agent = request.agent(app)
    const csrfResponse = await agent.get('/api/v1/auth/csrf')
    const preLoginCookie = csrfResponse.headers['set-cookie']?.[0] as string | undefined

    const response = await login(agent, STUDENT_A.email, STUDENT_A.password)
    expect(response.status).toBe(200)

    expect(response.body.student).toMatchObject({
      id: studentAId,
      name: 'Fictional Avery',
      email: STUDENT_A.email,
      mustChangePassword: false,
    })
    expect(response.body.student).not.toHaveProperty('password_hash')
    expect(response.body.enrollments).toHaveLength(1)
    expect(response.body.enrollments[0]).toMatchObject({
      cohort: 'Cohort A-TEST',
      overallProgressPct: 40,
    })
    expect(typeof response.body.csrfToken).toBe('string')

    const cookie = response.headers['set-cookie']?.[0] as string
    expect(cookie.toLowerCase()).toContain('httponly')
    expect(cookie.toLowerCase()).toContain('samesite=lax')
    expect(cookie.toLowerCase()).toContain('path=/')
    expect(cookie.toLowerCase()).not.toContain('secure')

    // Session id rotates on login (session fixation protection).
    if (preLoginCookie) {
      const before = preLoginCookie.split(';')[0]
      const after = cookie.split(';')[0]
      expect(after).not.toBe(before)
    }
  })

  it('keeps a session valid across a new app instance and allows coach access', async () => {
    const agent = request.agent(app)
    const loginResponse = await login(agent, STUDENT_A.email, STUDENT_A.password)
    expect(loginResponse.status).toBe(200)
    const cookie = loginResponse.headers['set-cookie']?.[0] as string

    const { createApp } = await import('../src/app')
    const restartedApp = createApp()

    const me = await request(restartedApp)
      .get('/api/v1/auth/me')
      .set('Cookie', cookie)
    expect(me.status).toBe(200)
    expect(me.body.student.email).toBe(STUDENT_A.email)

    const coach = await request(restartedApp)
      .get('/api/v1/me/coach')
      .set('Cookie', cookie)
    expect(coach.status).toBe(200)
    expect(coach.body.assessmentData).toBeDefined()
  })

  it('ignores a studentId parameter and only returns the session student', async () => {
    const agent = request.agent(app)
    const loginResponse = await login(agent, STUDENT_A.email, STUDENT_A.password)

    const response = await agent
      .get(`/api/v1/auth/me?studentId=${studentBId}`)
      .set('x-csrf-token', loginResponse.body.csrfToken)

    expect(response.status).toBe(200)
    expect(response.body.student.id).toBe(studentAId)
    expect(response.body.student.email).toBe(STUDENT_A.email)
    expect(response.body.enrollments).toHaveLength(1)
    expect(response.body.enrollments[0].cohort).toBe('Cohort A-TEST')
  })

  it('requires CSRF for logout and invalidates the session on logout', async () => {
    const agent = request.agent(app)
    const loginResponse = await login(agent, STUDENT_A.email, STUDENT_A.password)
    const csrf = loginResponse.body.csrfToken as string

    const missingCsrf = await agent.post('/api/v1/auth/logout')
    expect(missingCsrf.status).toBe(403)
    expect((await agent.get('/api/v1/auth/me')).status).toBe(200)

    const logout = await agent
      .post('/api/v1/auth/logout')
      .set('x-csrf-token', csrf)
    expect(logout.status).toBe(204)

    const me = await agent.get('/api/v1/auth/me')
    expect(me.status).toBe(401)
  })

  it(
    'rate limits repeated login attempts',
    async () => {
      const agent = request.agent(app)
      const token = await csrfFor(agent)

      const attempts = []
      for (let index = 0; index < 6; index += 1) {
        attempts.push(
          await agent
            .post('/api/v1/auth/login')
            .set('x-csrf-token', token)
            .send({ email: 'rate.limit@example.com', password: 'WrongPassw0rd!' }),
        )
      }

      expect(attempts.slice(0, 5).every((response) => response.status === 401)).toBe(true)
      expect(attempts[5]?.status).toBe(429)
      expect(attempts[5]?.body.error).toBe('too_many_requests')
    },
    15_000,
  )
})

describe('authorization', () => {
  it('prevents non-admin students from listing imports', async () => {
    const agent = request.agent(app)
    const response = await login(agent, STUDENT_A.email, STUDENT_A.password)
    expect(response.status).toBe(200)

    const imports = await agent.get('/api/v1/admin/imports')
    expect(imports.status).toBe(403)
    expect(imports.body.error).toBe('forbidden')
  })

  it('allows an admin to list imports', async () => {
    const agent = request.agent(app)
    const response = await login(agent, ADMIN.email, ADMIN.password)
    expect(response.status).toBe(200)

    const imports = await agent.get('/api/v1/admin/imports')
    expect(imports.status).toBe(200)
    expect(Array.isArray(imports.body.imports)).toBe(true)
  })
})
