import { buildCatalogResponse } from '@spd/shared'
import cors from 'cors'
import express, { type NextFunction, type Request, type Response } from 'express'
import { env } from './config/env'

/**
 * Phase 0 API surface only: liveness and the read-only catalog skeleton.
 * Auth, import, dashboard, and coach routes land in later phases.
 */
export function createApp(): express.Express {
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

  app.use((req: Request, res: Response) => {
    res.status(404).json({ error: 'not_found', path: req.path })
  })

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[api] Unhandled error', error)
    res.status(500).json({ error: 'internal_error' })
  })

  return app
}
