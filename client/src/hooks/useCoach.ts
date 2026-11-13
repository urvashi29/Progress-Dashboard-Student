import type { CoachSummary } from '@spd/shared'
import { useCallback, useEffect, useState } from 'react'
import { toApiError, type ApiError } from '../api/client'
import { fetchCoach } from '../api/coach'
import type { AsyncResource } from './useDashboard'

export function useCoach() {
  const [state, setState] = useState<AsyncResource<CoachSummary>>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setState({ status: 'loading' })

    fetchCoach(controller.signal)
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
