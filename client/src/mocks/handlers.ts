import { buildCatalogResponse, MOCK_DASHBOARD } from '@spd/shared'
import { http, HttpResponse } from 'msw'

export const handlers = [
  http.get('*/api/v1/catalog/modules', () => HttpResponse.json(buildCatalogResponse())),
  http.get('*/api/v1/me/dashboard', () => HttpResponse.json(MOCK_DASHBOARD)),
  http.get('*/api/v1/auth/me', () => HttpResponse.json(MOCK_DASHBOARD.student)),
]
