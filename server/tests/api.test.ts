import { CatalogResponseSchema, MODULES } from '@spd/shared'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app'

const app = createApp()

describe('GET /api/v1/healthz', () => {
  it('reports Phase 0 liveness', async () => {
    const response = await request(app).get('/api/v1/healthz')
    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({ status: 'ok', phase: 0 })
  })
})

describe('GET /api/v1/catalog/modules', () => {
  it('serves the validated 13-module catalog', async () => {
    const response = await request(app).get('/api/v1/catalog/modules')
    expect(response.status).toBe(200)

    const catalog = CatalogResponseSchema.parse(response.body)
    expect(catalog.modules).toHaveLength(13)
    expect(catalog.tracks).toHaveLength(4)
    expect(catalog.skillsAreEstimated).toBe(true)
    expect(catalog.modules.map((entry) => entry.slug)).toEqual(
      MODULES.map((entry) => entry.slug),
    )
  })

  it('marks every skill as an estimate', async () => {
    const response = await request(app).get('/api/v1/catalog/modules')
    const catalog = CatalogResponseSchema.parse(response.body)
    for (const entry of catalog.modules) {
      for (const skill of entry.skills) {
        expect(skill.estimated).toBe(true)
      }
    }
  })
})

describe('unknown routes', () => {
  it('returns a JSON 404', async () => {
    const response = await request(app).get('/api/v1/not-a-route')
    expect(response.status).toBe(404)
    expect(response.body).toMatchObject({ error: 'not_found' })
  })
})
