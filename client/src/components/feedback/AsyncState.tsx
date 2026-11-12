import type { ReactNode } from 'react'
import { Button } from '../ui/Button'

export function Spinner() {
  return <span className="spinner" aria-hidden="true" />
}

export function PageLoading({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="page-status" role="status" aria-live="polite">
      <Spinner />
      <p>{label}</p>
    </div>
  )
}

type PageErrorProps = {
  title: string
  message: string
  actionLabel?: string
  onAction?: () => void
  secondary?: ReactNode
}

export function PageError({ title, message, actionLabel, onAction, secondary }: PageErrorProps) {
  return (
    <div className="page-status state-panel state-panel--error" role="alert">
      <h1>{title}</h1>
      <p>{message}</p>
      <div className="state-panel__actions">
        {actionLabel && onAction ? (
          <Button variant="primary" onClick={onAction}>
            {actionLabel}
          </Button>
        ) : null}
        {secondary}
      </div>
    </div>
  )
}

type EmptyStateProps = {
  title: string
  message: string
}

export function EmptyState({ title, message }: EmptyStateProps) {
  return (
    <div className="state-panel state-panel--empty">
      <h3>{title}</h3>
      <p>{message}</p>
    </div>
  )
}
