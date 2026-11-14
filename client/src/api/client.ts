import { z, type ZodTypeAny } from 'zod'

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '/api/v1').replace(/\/+$/, '')

/**
 * Double-submit CSRF token held in memory only. It is never written to
 * localStorage/sessionStorage; a reload re-fetches it from the server session.
 */
let csrfToken: string | null = null

export function setCsrfToken(token: string | null): void {
  csrfToken = token
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

type ApiInit = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string | null

  constructor(message: string, status: number, code: string | null = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }

  get isUnauthorized(): boolean {
    return this.status === 401
  }

  get isForbidden(): boolean {
    return this.status === 403
  }

  get isCsrfError(): boolean {
    return this.code === 'invalid_csrf_token'
  }

  get isNotFound(): boolean {
    return this.status === 404
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function defaultErrorMessage(status: number, code: string | null): string {
  if (code === 'invalid_credentials') return 'Email or password is incorrect.'
  if (code === 'invalid_csrf_token') {
    return 'Your security token expired. Refresh the page and try again.'
  }
  if (code === 'validation_error') return 'Please check the information and try again.'
  if (code === 'internal_error') return 'Something went wrong on our side. Please try again.'
  if (code === 'unauthorized') return 'Please sign in to continue.'
  if (code === 'forbidden') return 'You do not have access to this resource.'
  if (status === 401) return 'Please sign in to continue.'
  if (status === 403) return 'You do not have access to this resource.'
  if (status === 404) return 'We could not find what you requested.'
  if (status >= 500) return 'Something went wrong on our side. Please try again.'
  return 'The request could not be completed.'
}

async function readError(response: Response): Promise<{ message: string | null; code: string | null }> {
  try {
    const data: unknown = await response.json()
    if (!isRecord(data)) return { message: null, code: null }
    const message = typeof data.message === 'string' ? data.message : null
    const code =
      typeof data.error === 'string' ? data.error : typeof data.code === 'string' ? data.code : null
    return { message, code }
  } catch {
    return { message: null, code: null }
  }
}

async function sendRequest(path: string, init: ApiInit): Promise<Response> {
  const method = init.method ?? 'GET'
  const headers = new Headers()
  if (init.body !== undefined) headers.set('Content-Type', 'application/json')
  if (!SAFE_METHODS.has(method) && csrfToken) headers.set('x-csrf-token', csrfToken)

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      credentials: 'include',
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: init.signal,
    })
  } catch (error) {
    if (init.signal?.aborted) throw error
    throw new ApiError(
      'Unable to reach the server. Check your connection and try again.',
      0,
      'network_error',
    )
  }

  if (!response.ok) {
    const { message, code } = await readError(response)
    throw new ApiError(message ?? defaultErrorMessage(response.status, code), response.status, code)
  }

  return response
}

export async function apiRequest<S extends ZodTypeAny>(
  path: string,
  schema: S,
  init: ApiInit = {},
): Promise<z.output<S>> {
  const response = await sendRequest(path, init)
  let data: unknown
  try {
    data = await response.json()
  } catch {
    throw new ApiError('The server returned an unexpected response.', response.status, 'invalid_response')
  }

  try {
    return schema.parse(data) as z.output<S>
  } catch {
    throw new ApiError('The server returned an unexpected response.', response.status, 'invalid_response')
  }
}

export async function apiRequestVoid(path: string, init: ApiInit = {}): Promise<void> {
  await sendRequest(path, init)
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  return new ApiError('Something went wrong. Please try again.', 0, 'unknown_error')
}
