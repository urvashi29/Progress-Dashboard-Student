import { buildCatalogResponse, MOCK_DASHBOARD } from '@spd/shared'
import { http, HttpResponse } from 'msw'
import { DEMO_EMAIL, DEMO_PASSWORD } from '../lib/demo'
import { buildModuleDetail } from './data'
import { clearMockSession, hasMockSession, setMockSession } from './state'

const API = '*/api/v1'
const MOCK_CSRF_TOKEN = 'mock-csrf-token'

const unauthorized = () =>
  HttpResponse.json(
    {
      error: 'unauthorized',
      message: 'Your session has expired. Please sign in again.',
    },
    { status: 401 },
  )

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null
}

export const handlers = [
  http.get(`${API}/catalog/modules`, () => HttpResponse.json(buildCatalogResponse())),

  http.get(`${API}/auth/csrf`, () => HttpResponse.json({ csrfToken: MOCK_CSRF_TOKEN })),

  http.post(`${API}/auth/login`, async ({ request }) => {
    const payload = asRecord(await request.json().catch(() => null))
    const email = typeof payload?.email === 'string' ? payload.email.trim().toLowerCase() : ''
    const password = typeof payload?.password === 'string' ? payload.password : ''

    if (!email || !password) {
      return HttpResponse.json(
        { error: 'validation_error', message: 'Email and password are required.' },
        { status: 400 },
      )
    }

    if (email !== DEMO_EMAIL || password !== DEMO_PASSWORD) {
      return HttpResponse.json(
        { error: 'invalid_credentials', message: 'Email or password is incorrect.' },
        { status: 401 },
      )
    }

    setMockSession(true)
    return HttpResponse.json({
      student: MOCK_DASHBOARD.student,
      csrfToken: MOCK_CSRF_TOKEN,
    })
  }),

  http.post(`${API}/auth/logout`, () => {
    clearMockSession()
    return new HttpResponse(null, { status: 204 })
  }),

  http.get(`${API}/auth/me`, () => {
    if (!hasMockSession()) return unauthorized()
    return HttpResponse.json({
      student: MOCK_DASHBOARD.student,
      csrfToken: MOCK_CSRF_TOKEN,
    })
  }),

  http.get(`${API}/me/dashboard`, () => {
    if (!hasMockSession()) return unauthorized()
    return HttpResponse.json(MOCK_DASHBOARD)
  }),

  http.get(`${API}/me/modules`, () => {
    if (!hasMockSession()) return unauthorized()
    return HttpResponse.json(MOCK_DASHBOARD.modules)
  }),

  http.get(`${API}/me/modules/:slug`, ({ params }) => {
    if (!hasMockSession()) return unauthorized()
    const slug = typeof params.slug === 'string' ? params.slug : ''
    const detail = buildModuleDetail(slug)
    if (!detail) {
      return HttpResponse.json(
        { error: 'not_found', message: 'Module not found.' },
        { status: 404 },
      )
    }
    return HttpResponse.json(detail)
  }),

  http.get(`${API}/me/coach`, () => {
    if (!hasMockSession()) return unauthorized()
    return HttpResponse.json(MOCK_DASHBOARD.coachSummary)
  }),
]
