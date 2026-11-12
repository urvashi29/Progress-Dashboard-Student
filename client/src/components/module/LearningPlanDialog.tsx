import type { ActivityTemplate } from '@spd/shared'
import { useEffect, useRef } from 'react'
import { formatPercent } from '../../lib/format'
import { Button } from '../ui/Button'

type LearningPlanDialogProps = {
  open: boolean
  onClose: () => void
  moduleName: string
  remainingPct: number | null
  activities: ActivityTemplate[]
}

export function LearningPlanDialog({
  open,
  onClose,
  moduleName,
  remainingPct,
  activities,
}: LearningPlanDialogProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    closeButtonRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="learning-plan-dialog-heading"
        aria-describedby="learning-plan-dialog-note"
      >
        <div className="modal__header">
          <h2 id="learning-plan-dialog-heading">How to Complete This Module Faster</h2>
          <button
            ref={closeButtonRef}
            type="button"
            className="modal__close"
            onClick={onClose}
            aria-label="Close learning plan preview"
          >
            Close
          </button>
        </div>

        <p id="learning-plan-dialog-note" className="modal__note">
          This is a clearly labeled preview placeholder, not personalized AI advice. The
          recommendation engine that builds fast-completion plans arrives in a later phase.
        </p>

        <h3>What this preview shows for {moduleName}</h3>
        {remainingPct === null ? (
          <p>
            This module is not in your current plan, so there is no remaining progress to display.
          </p>
        ) : (
          <p>
            You have <strong>{formatPercent(remainingPct)}</strong> of this module left to complete
            according to the platform.
          </p>
        )}

        {activities.length > 0 ? (
          <>
            <h3>Catalog activity suggestions</h3>
            <ul className="modal__list">
              {activities.map((activity) => (
                <li key={activity.title}>
                  {activity.title} — {activity.minutes} min ({activity.type})
                </li>
              ))}
            </ul>
          </>
        ) : null}

        <p className="modal__caveat">
          Skills are estimated from module progress, not measured. Confidence stays low until
          stronger evidence exists.
        </p>

        <div className="modal__actions">
          <Button variant="primary" onClick={onClose}>
            Close preview
          </Button>
        </div>
      </div>
    </div>
  )
}
