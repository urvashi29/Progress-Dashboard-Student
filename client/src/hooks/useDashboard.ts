import type { DashboardResponse } from '@spd/shared'
import { useCallback, useEffect, useState } from 'react'
import { fetchDashboard } from '../api/dashboard'
import { toApiError, type ApiError } from '../api/client'

export type AsyncResource<T> =
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: ApiError }

export function useDashboard() {
  const [state, setState] = useState<AsyncResource<DashboardResponse>>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setState({ status: 'loading' })

    fetchDashboard(controller.signal)
      .then((data) => {
        if (active) setState({ status: 'success', data })
      })
      .catch((error: unknown) => {
        if (!active || controller.signal.aborted) return
        setState({ status: 'error', error: toApiError(error) })
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [attempt])

  const reload = useCallback(() => setAttempt((value) => value + 1), [])

  return { state, reload }
}
