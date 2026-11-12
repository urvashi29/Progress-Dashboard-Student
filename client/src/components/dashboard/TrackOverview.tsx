import {
  TRACKS,
  type DashboardModule,
  type TrackRollup,
} from '@spd/shared'
import { formatPercent } from '../../lib/format'
import { ProgressBar } from '../ui/ProgressBar'

type TrackOverviewProps = {
  tracks: TrackRollup[]
  modules: DashboardModule[]
}

export function TrackOverview({ tracks, modules }: TrackOverviewProps) {
  return (
    <section className="section" aria-labelledby="tracks-heading">
      <div className="section-heading">
        <h2 id="tracks-heading">Learning tracks</h2>
        <p className="muted">
          Track progress is a derived average of the modules in each track. It is reference only and
          is not the same as your authoritative overall progress.
        </p>
      </div>

      <ul className="track-grid">
        {TRACKS.map((track) => {
          const rollup = tracks.find((entry) => entry.track === track.slug)
          const trackModules = modules.filter((entry) => entry.track === track.slug)
          const inPlanModules = trackModules.filter((entry) => entry.inPlan)
          const completed = inPlanModules.filter((entry) => entry.progressPct >= 100).length
          const started = inPlanModules.filter(
            (entry) => entry.progressPct > 0 && entry.progressPct < 100,
          ).length
          const average = rollup?.averageProgressPct ?? null

          return (
            <li key={track.slug} className="card track-card">
              <div className="track-card__header">
                <h3>{track.name}</h3>
                <span className="track-card__count">{trackModules.length} modules</span>
              </div>
              <p className="track-card__plan">
                {inPlanModules.length} in your plan
                {inPlanModules.length > 0
                  ? ` · ${completed} completed · ${started} started`
                  : ''}
              </p>

              <div className="track-card__progress">
                <div className="track-card__progress-label">
                  <span>Track progress (derived)</span>
                  <strong>{average === null ? 'Not available' : formatPercent(average)}</strong>
                </div>
                {average === null ? (
                  <p className="muted track-card__empty">No modules from this track are in your plan.</p>
                ) : (
                  <ProgressBar
                    value={average}
                    label={`${track.name} derived track progress`}
                    tone="info"
                    size="sm"
                  />
                )}
              </div>

              <p className="track-card__note">Reference only — not your overall progress.</p>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
