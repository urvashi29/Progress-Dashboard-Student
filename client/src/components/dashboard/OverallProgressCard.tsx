import type { ProgressComparison } from '@spd/shared'
import { formatPercent } from '../../lib/format'
import { ProgressBar } from '../ui/ProgressBar'
import { ProgressRing } from '../ui/ProgressRing'

type OverallProgressCardProps = {
  overallProgressPct: number
  progressComparison: ProgressComparison
}

export function OverallProgressCard({
  overallProgressPct,
  progressComparison,
}: OverallProgressCardProps) {
  const moduleAverage = progressComparison.moduleAveragePct

  return (
    <section className="card overall-card" aria-labelledby="overall-progress-heading">
      <div className="overall-card__body">
        <p className="eyebrow">Overall progress</p>
        <h2 id="overall-progress-heading" className="overall-card__headline">
          {formatPercent(overallProgressPct)} of your course completed
        </h2>
        <p className="muted">
          This is the overall progress reported by your learning platform. It is not calculated by
          averaging your module percentages.
        </p>
        <ProgressBar
          value={overallProgressPct}
          label="Overall course progress"
          tone="info"
          size="lg"
        />
        <p className="overall-card__reference">
          Module average (reference only):{' '}
          <strong>{moduleAverage === null ? 'Not available' : formatPercent(moduleAverage)}</strong>.
          This is not your overall progress.
        </p>
      </div>
      <div className="overall-card__visual">
        <ProgressRing value={overallProgressPct} label="overall" />
      </div>
    </section>
  )
}
