import express, { type NextFunction, type Request, type Response } from 'express'
import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'
import { apiErrorHandler } from '../src/http/errors'

function createResponse(headersSent: boolean): Response {
  const response = {
    headersSent,
    status: vi.fn(),
    json: vi.fn(),
  }
  response.status.mockReturnValue(response)
  return response as unknown as Response
}

describe('apiErrorHandler', () => {
  it('writes a safe 500 response when headers have not been sent', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const res = createResponse(false)
    const next = vi.fn() as NextFunction

    apiErrorHandler(new Error('database unavailable'), {} as Request, res, next)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({ error: 'internal_error' })
    expect(next).not.toHaveBeenCalled()
    errorSpy.mockRestore()
  })

  it('delegates instead of writing when headers were already sent', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const res = createResponse(true)
    const next = vi.fn() as NextFunction
    const error = new Error('session store failed after response')

    apiErrorHandler(error, {} as Request, res, next)

    expect(res.status).not.toHaveBeenCalled()
    expect(res.json).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledWith(error)
    errorSpy.mockRestore()
  })

  it('does not write a second response when a handler fails after sending headers', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const app = express()

    app.get('/late-failure', (_req, res) => {
      res.status(200).json({ ok: true })
      throw new Error('session store failed after response')
    })
    app.use(apiErrorHandler)

    const response = await request(app).get('/late-failure')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ ok: true })
    errorSpy.mockRestore()
  })
})
