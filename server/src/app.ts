import { buildCatalogResponse } from '@spd/shared'
import cors from 'cors'
import express, { type Request, type Response } from 'express'
import helmet from 'helmet'
import { createAuthRouter } from './auth/routes'
import { createLoginRateLimiter } from './auth/rate-limit'
import { createSessionMiddleware } from './auth/session'
import { env } from './config/env'
import { db } from './db/client'
import { apiErrorHandler } from './http/errors'
import { createAdminImportRouter } from './ingestion/routes'

/**
 * Phase 1 API surface: health, catalog, cookie authentication, and the
 * admin-only Excel import. Dashboard/read routes belong to Phase 2.
 */
export function createApp(): express.Express {
  const app = express()

  app.disable('x-powered-by')
  app.set('trust proxy', 1)
  app.use(helmet())
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }))
  app.use(express.json({ limit: '1mb' }))
  app.use(createSessionMiddleware(db))

  const loginRateLimiter = createLoginRateLimiter()
  app.locals.loginRateLimiter = loginRateLimiter

  app.get('/api/v1/healthz', (_req: Request, res: Response) => {
    res.json({ status: 'ok', phase: 1, timestamp: new Date().toISOString() })
  })

  app.get('/api/v1/catalog/modules', (_req: Request, res: Response) => {
    res.json(buildCatalogResponse())
  })

  app.use('/api/v1/auth', createAuthRouter(loginRateLimiter))
  app.use('/api/v1/admin', createAdminImportRouter())

  app.use((req: Request, res: Response) => {
    res.status(404).json({ error: 'not_found', path: req.path })
  })

  app.use(apiErrorHandler)

  return app
}
