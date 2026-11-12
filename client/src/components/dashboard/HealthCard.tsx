import type { HealthAssessment } from '@spd/shared'
import { formatDaysAgo, formatIsoDate, formatPercent, formatRatio } from '../../lib/format'
import { HEALTH_TONE } from '../../lib/status'
import { StatusBadge } from '../ui/StatusBadge'

type HealthCardProps = {
  health: HealthAssessment
  overallProgressPct: number
  progressUpdatedAt: string
}

export function HealthCard({ health, overallProgressPct, progressUpdatedAt }: HealthCardProps) {
  const tone = HEALTH_TONE[health.status]

  return (
    <section
      className={`card health-card health-card--${tone}`}
      aria-labelledby="learning-health-heading"
    >
      <div className="health-card__header">
        <div>
          <p className="eyebrow">Learning health</p>
          <h2 id="learning-health-heading">Learning health</h2>
        </div>
        <StatusBadge label={health.label} tone={tone} />
      </div>

      <p className="health-card__status-label">{health.label}</p>

      <dl className="health-metrics">
        <div className="health-metrics__item">
          <dt>Expected progress</dt>
          <dd>{formatPercent(health.expectedPct)}</dd>
        </div>
        <div className="health-metrics__item">
          <dt>Your overall progress</dt>
          <dd>{formatPercent(overallProgressPct)}</dd>
        </div>
        <div className="health-metrics__item">
          <dt>Pace</dt>
          <dd>
            {health.paceRatio === null
              ? 'Not enough cohort time to judge pace yet'
              : `${formatRatio(health.paceRatio)} of expected pace`}
          </dd>
        </div>
        <div className="health-metrics__item">
          <dt>Last progress update</dt>
          <dd>
            {formatIsoDate(progressUpdatedAt)}
            <span className="health-metrics__sub">({formatDaysAgo(health.staleDays)})</span>
          </dd>
        </div>
      </dl>

      <div className="health-card__reasons">
        <h3>Why this status</h3>
        <ul>
          {health.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </div>

      <p className="muted health-card__note">
        Status, pace, and reasons are calculated by the progress API. Color is paired with a text
        label so the status never relies on color alone.
      </p>
    </section>
  )
}
