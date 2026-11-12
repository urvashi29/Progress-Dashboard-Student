import type { NextFunction, Request, RequestHandler, Response } from 'express'
import { MulterError } from 'multer'
import { ZodError } from 'zod'

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message?: string,
    readonly details?: unknown,
  ) {
    super(message ?? code)
    this.name = 'HttpError'
  }
}

export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    void Promise.resolve(handler(req, res, next)).catch(next)
  }
}

/**
 * Central error translation. Never echo raw request bodies or database errors:
 * they can contain student PII or password material.
 */
export function apiErrorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (error instanceof HttpError) {
    res.status(error.status).json({
      error: error.code,
      ...(error.details === undefined ? {} : { details: error.details }),
    })
    return
  }

  if (error instanceof ZodError) {
    res.status(400).json({
      error: 'validation_error',
      details: error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    })
    return
  }

  if (error instanceof MulterError) {
    const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400
    res.status(status).json({ error: error.code.toLowerCase() })
    return
  }

  console.error('[api] Unhandled error', error instanceof Error ? error.message : 'unknown')
  res.status(500).json({ error: 'internal_error' })
}
