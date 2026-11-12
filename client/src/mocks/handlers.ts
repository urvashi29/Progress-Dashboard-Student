import { buildCatalogResponse, MOCK_DASHBOARD } from '@spd/shared'
import { http, HttpResponse } from 'msw'
import { DEMO_EMAIL, DEMO_PASSWORD } from '../lib/demo'
import { buildModuleDetail } from './data'
import { MOCK_CAREER_PATHS, MOCK_SKILLOGRAPHY } from './skillography'
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

  http.get(`${API}/me/skills`, () => {
    if (!hasMockSession()) return unauthorized()
    return HttpResponse.json({
      skills: MOCK_SKILLOGRAPHY.skills,
      practiceAreas: MOCK_SKILLOGRAPHY.practiceAreas,
      methodology: MOCK_SKILLOGRAPHY.methodology,
      limitations: MOCK_SKILLOGRAPHY.limitations,
      skillsAreEstimated: MOCK_SKILLOGRAPHY.skillsAreEstimated,
      proficiencyAvailable: MOCK_SKILLOGRAPHY.proficiencyAvailable,
      generatedAt: MOCK_SKILLOGRAPHY.generatedAt,
    })
  }),

  http.get(`${API}/me/skillography`, () => {
    if (!hasMockSession()) return unauthorized()
    return HttpResponse.json(MOCK_SKILLOGRAPHY)
  }),

  http.get(`${API}/me/career-paths`, () => {
    if (!hasMockSession()) return unauthorized()
    return HttpResponse.json(MOCK_CAREER_PATHS)
  }),

  http.get(`${API}/me/career-paths/:slug`, ({ params }) => {
    if (!hasMockSession()) return unauthorized()
    const slug = typeof params.slug === 'string' ? params.slug : ''
    const careerPath = MOCK_CAREER_PATHS.careerPaths.find((entry) => entry.slug === slug)
    if (!careerPath) {
      return HttpResponse.json(
        { error: 'career_path_not_found', message: 'Career pathway not found.' },
        { status: 404 },
      )
    }
    return HttpResponse.json({
      careerPath,
      methodology: MOCK_CAREER_PATHS.methodology,
      limitations: MOCK_CAREER_PATHS.limitations,
      generatedAt: MOCK_CAREER_PATHS.generatedAt,
    })
  }),
]
