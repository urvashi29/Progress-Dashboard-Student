import type { CareerPathListResponse, SkillographyResponse } from '@spd/shared'
import { useCallback, useEffect, useState } from 'react'
import { toApiError, type ApiError } from '../api/client'
import { fetchCareerPaths, fetchSkillography } from '../api/skillography'
import type { AsyncResource } from './useDashboard'

export type SkillographyBundle = {
  skillography: SkillographyResponse
  careerPaths: CareerPathListResponse
}

export function useSkillography() {
  const [state, setState] = useState<AsyncResource<SkillographyBundle>>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setState({ status: 'loading' })

    Promise.all([
      fetchSkillography(controller.signal),
      fetchCareerPaths(controller.signal),
    ])
      .then(([skillography, careerPaths]) => {
        if (active) setState({ status: 'success', data: { skillography, careerPaths } })
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
