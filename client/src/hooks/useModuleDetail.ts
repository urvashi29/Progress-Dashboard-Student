import { useCallback, useEffect, useState } from 'react'
import { toApiError, type ApiError } from '../api/client'
import { fetchModuleDetail } from '../api/modules'
import type { ModuleDetailResponse } from '../api/contracts'

export type ModuleResource =
  | { status: 'loading' }
  | { status: 'success'; data: ModuleDetailResponse }
  | { status: 'error'; error: ApiError }

export function useModuleDetail(slug: string) {
  const [state, setState] = useState<ModuleResource>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setState({ status: 'loading' })

    fetchModuleDetail(slug, controller.signal)
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
  }, [slug, attempt])

  const reload = useCallback(() => setAttempt((value) => value + 1), [])

  return { state, reload }
}
