import { MOCK_STUDENTS, normalizeEmail } from '@spd/shared'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Express } from 'express'
import type { Knex } from 'knex'
import { bootstrapDatabase, prepareTestEnvironment } from './helpers/test-workspace'

const workspace = prepareTestEnvironment({ LLM_PROVIDER: 'disabled' })
const demoEmail = normalizeEmail(MOCK_STUDENTS[0]?.email ?? '')
const demoPassword = process.env.DEMO_DEFAULT_PASSWORD ?? ''

let db: Knex
let app: Express

async function csrfFor(agent: ReturnType<typeof request.agent>): Promise<string> {
  const response = await agent.get('/api/v1/auth/csrf')
  expect(response.status).toBe(200)
  return response.body.csrfToken as string
}

beforeAll(async () => {
  db = await bootstrapDatabase()

  const { seedDemoData } = await import('../src/db/seed')
  await seedDemoData()

  const { provisionDemoAccount } = await import('../src/db/demo-account')
  await provisionDemoAccount()

  const { createApp } = await import('../src/app')
  app = createApp()
})

afterAll(async () => {
  if (db) await db.destroy()
  workspace.cleanup()
})

describe('fictional demo account end to end', () => {
  it('seeds a usable demo student without exposing password material', async () => {
    const student = await db('students').where({ email: demoEmail }).first<{
      password_hash: string | null
      must_change_password: boolean | number
    }>()

    expect(student?.password_hash).toEqual(expect.any(String))
    expect(student?.must_change_password).toBeFalsy()
    expect(demoPassword.length).toBeGreaterThan(0)
  })

  it('logs in, survives a new app instance, uses protected APIs, and logs out', async () => {
    const agent = request.agent(app)
    const csrfToken = await csrfFor(agent)
    const login = await agent
      .post('/api/v1/auth/login')
      .set('x-csrf-token', csrfToken)
      .send({ email: demoEmail, password: demoPassword })

    expect(login.status).toBe(200)
    expect(login.body.student.email).toBe(demoEmail)
    expect(login.body.enrollments).toHaveLength(1)
    const cookie = login.headers['set-cookie']?.[0] as string
    const sessionCsrf = login.body.csrfToken as string

    const { createApp } = await import('../src/app')
    const restartedApp = createApp()

    const me = await request(restartedApp).get('/api/v1/auth/me').set('Cookie', cookie)
    expect(me.status).toBe(200)
    expect(me.body.student.email).toBe(demoEmail)

    const dashboard = await request(restartedApp)
      .get('/api/v1/me/dashboard')
      .set('Cookie', cookie)
    expect(dashboard.status).toBe(200)
    expect(dashboard.body.student.email).toBe(demoEmail)

    const coach = await request(restartedApp)
      .get('/api/v1/me/coach')
      .set('Cookie', cookie)
    expect(coach.status).toBe(200)
    expect(coach.body.assessmentData).toBeDefined()

    const logout = await request(restartedApp)
      .post('/api/v1/auth/logout')
      .set('Cookie', cookie)
      .set('x-csrf-token', sessionCsrf)
    expect(logout.status).toBe(204)

    const afterLogout = await request(restartedApp)
      .get('/api/v1/auth/me')
      .set('Cookie', cookie)
    expect(afterLogout.status).toBe(401)
  })
})
