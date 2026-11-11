import { buildCatalogResponse } from '@spd/shared'
import cors from 'cors'
import express, { type NextFunction, type Request, type Response } from 'express'
import { env } from './config/env'
import { sessionIdentityResolver, type IdentityResolver } from './http/identity'
import { createMeRouter } from './http/me-routes'
import { systemClock, type Clock } from './platform/time'
import type { Repositories } from './repositories/contracts'
import { createKnexRepositories } from './repositories/knex'

export interface CreateAppOptions {
  /** Injectable persistence adapter; defaults to read-only Knex repositories. */
  repositories?: Repositories
  /** Injectable clock keeps health and timestamps deterministic in tests. */
  clock?: Clock
  identityResolver?: IdentityResolver
  timeZone?: string
}

export function createApp(options: CreateAppOptions = {}): express.Express {
  const app = express()

  app.disable('x-powered-by')
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }))
  app.use(express.json({ limit: '1mb' }))

  app.get('/api/v1/healthz', (_req: Request, res: Response) => {
    res.json({ status: 'ok', phase: 0, timestamp: new Date().toISOString() })
  })

  app.get('/api/v1/catalog/modules', (_req: Request, res: Response) => {
    res.json(buildCatalogResponse())
  })

  app.use(
    '/api/v1/me',
    createMeRouter({
      repositories: options.repositories ?? createKnexRepositories(),
      clock: options.clock ?? systemClock,
      identityResolver: options.identityResolver ?? sessionIdentityResolver,
      timeZone: options.timeZone,
    }),
  )

  app.use((req: Request, res: Response) => {
    res.status(404).json({ error: 'not_found', path: req.path })
  })

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[api] Unhandled error', error)
    res.status(500).json({ error: 'internal_error' })
  })

  return app
}
