import type { CoachAskResponse, CoachModuleGuide, CoachSummary } from '@spd/shared'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toApiError, type ApiError } from '../api/client'
import { askCoach, fetchCoach, fetchModuleGuide } from '../api/coach'
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

export type CoachGuideState =
  | { status: 'idle' }
  | AsyncResource<CoachModuleGuide>

export function useModuleGuide() {
  const [state, setState] = useState<CoachGuideState>({ status: 'idle' })
  const controllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => controllerRef.current?.abort()
  }, [])

  const load = useCallback((moduleSlug: string) => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    setState({ status: 'loading' })

    fetchModuleGuide(moduleSlug, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ status: 'success', data })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setState({ status: 'error', error: toApiError(error) })
      })
  }, [])

  const reset = useCallback(() => {
    controllerRef.current?.abort()
    setState({ status: 'idle' })
  }, [])

  return { state, load, reset }
}

export type CoachAskState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: CoachAskResponse }
  | { status: 'error'; error: ApiError }

export function useAskCoach() {
  const [state, setState] = useState<CoachAskState>({ status: 'idle' })
  const controllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => controllerRef.current?.abort()
  }, [])

  const ask = useCallback((question: string, moduleSlug?: string) => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    setState({ status: 'loading' })

    askCoach(question, moduleSlug, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ status: 'success', data })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setState({ status: 'error', error: toApiError(error) })
      })
  }, [])

  return { state, ask }
}
