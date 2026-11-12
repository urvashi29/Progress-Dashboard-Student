import { TRACKS, type DashboardModule } from '@spd/shared'
import { Link } from 'react-router-dom'
import { formatPercent } from '../../lib/format'
import { MODULE_BAND_LABEL, MODULE_BAND_TONE } from '../../lib/status'
import { ProgressBar } from '../ui/ProgressBar'
import { StatusBadge } from '../ui/StatusBadge'

export function ModuleCard({ module }: { module: DashboardModule }) {
  const trackName = TRACKS.find((track) => track.slug === module.track)?.name ?? module.track
  const headingId = `module-${module.moduleSlug}-heading`
  const tone = MODULE_BAND_TONE[module.band]

  return (
    <article className="card module-card" aria-labelledby={headingId}>
      <div className="module-card__top">
        <span className="module-card__track">{trackName}</span>
        <StatusBadge label={MODULE_BAND_LABEL[module.band]} tone={tone} />
      </div>
      <h4 id={headingId} className="module-card__title">
        {module.name}
      </h4>

      {module.inPlan ? (
        <div className="module-card__progress">
          <div className="module-card__progress-label">
            <strong>{formatPercent(module.progressPct)}</strong>
            <span>complete</span>
          </div>
          <ProgressBar
            value={module.progressPct}
            label={`${module.name} progress`}
            tone={tone}
            size="sm"
          />
        </div>
      ) : (
        <p className="module-card__not-in-plan">
          Not included in your current plan. Ask your program team if you need access.
        </p>
      )}

      <Link
        className="btn btn--ghost module-card__action"
        to={`/modules/${module.moduleSlug}`}
        aria-label={`View ${module.name} module details`}
      >
        View module details
      </Link>
    </article>
  )
}
