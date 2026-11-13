import type { NextFunction, Request, Response } from 'express'
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
})
