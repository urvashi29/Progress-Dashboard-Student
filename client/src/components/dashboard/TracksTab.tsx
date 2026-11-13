import {
  TRACKS,
  type DashboardModule,
  type TrackRollup,
  type TrackSlug,
} from '@spd/shared'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { CHART_THEME } from '../../lib/chartTheme'
import { formatPercent } from '../../lib/format'
import { ChartTable } from '../ui/ChartTable'
import { ProgressBar } from '../ui/ProgressBar'
import { Button } from '../ui/Button'

type TracksTabProps = {
  tracks: TrackRollup[]
  modules: DashboardModule[]
  selectedTrack: TrackSlug | null
  onSelectTrack: (track: TrackSlug | null) => void
  onOpenModule: (slug: string) => void
}

export function TracksTab({
  tracks,
  modules,
  selectedTrack,
  onSelectTrack,
  onOpenModule,
}: TracksTabProps) {
  const orderedTracks: TrackRollup[] = TRACKS.map((track) =>
    tracks.find((rollup) => rollup.track === track.slug),
  ).filter((rollup): rollup is TrackRollup => Boolean(rollup))

  const chartRows = orderedTracks.map((rollup) => ({
    track: rollup.track,
    name: rollup.name,
    fullName: rollup.name,
    progress: rollup.averageProgressPct ?? 0,
    hasProgress: rollup.averageProgressPct !== null,
  }))

  const selectedRollup = selectedTrack
    ? orderedTracks.find((rollup) => rollup.track === selectedTrack) ?? null
    : null

  const contributingModules = selectedTrack
    ? modules
        .filter((module) => module.track === selectedTrack)
        .sort((a, b) => a.catalogOrder - b.catalogOrder)
    : []

  return (
    <section className="tab-panel" aria-labelledby="tracks-tab-heading">
      <div className="section-heading">
        <h2 id="tracks-tab-heading">Learning tracks</h2>
        <p className="muted">
          Track progress is a derived average of in-plan modules. It is reference only and is not
          your authoritative overall progress.
        </p>
      </div>

      <figure className="chart-card" aria-labelledby="track-chart-heading">
        <figcaption>
          <h3 id="track-chart-heading">Track comparison</h3>
          <p className="muted">
            Hover a bar for exact values. Select a bar or track card to see its contributing
            modules.
          </p>
        </figcaption>
        <div
          className="chart-canvas"
          role="img"
          aria-label="Bar chart comparing derived progress across the four learning tracks"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartRows} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_THEME.grid} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11 }}
                stroke={CHART_THEME.axis}
                interval={0}
                tickLine={false}
              />
              <YAxis
                type="number"
                domain={[0, 100]}
                unit="%"
                tick={{ fontSize: 11 }}
                stroke={CHART_THEME.axis}
                width={38}
              />
              <Tooltip formatter={(value) => `${value}%`} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar
                dataKey="progress"
                name="Derived track progress"
                radius={[6, 6, 0, 0]}
                barSize={46}
                cursor="pointer"
                onClick={(entry) => {
                  const payload = entry as { payload?: { track?: TrackSlug } }
                  if (payload.payload?.track) onSelectTrack(payload.payload.track)
                }}
              >
                {chartRows.map((row, index) => (
                  <Cell
                    key={row.track}
                    fill={CHART_THEME.trackSeries[index % CHART_THEME.trackSeries.length]}
                    opacity={selectedTrack && selectedTrack !== row.track ? 0.45 : 1}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <ChartTable
          caption="Learning track comparison data"
          columns={['Track', 'Derived progress', 'Modules in plan']}
          rows={orderedTracks.map((rollup) => ({
            key: rollup.track,
            cells: [
              rollup.name,
              rollup.averageProgressPct === null ? 'No estimate' : formatPercent(rollup.averageProgressPct),
              `${rollup.inPlanCount} of ${rollup.moduleCount}`,
            ],
          }))}
        />
      </figure>

      <div className="tracks-layout">
        <div className="track-grid" aria-label="Learning track cards">
          {orderedTracks.map((rollup) => {
            const selected = selectedTrack === rollup.track
            const completedCount = modules.filter(
              (module) =>
                module.track === rollup.track && module.inPlan && module.progressPct >= 100,
            ).length
            return (
              <button
                key={rollup.track}
                type="button"
                className="track-card"
                aria-pressed={selected}
                onClick={() => onSelectTrack(selected ? null : rollup.track)}
              >
                <div className="track-card__header">
                  <h3>{rollup.name}</h3>
                  <span className="track-card__count">{rollup.moduleCount} modules</span>
                </div>
                <p className="track-card__plan">
                  {rollup.inPlanCount} in your plan · {completedCount} completed
                  {rollup.averageProgressPct === null
                    ? ''
                    : ` · ${formatPercent(rollup.averageProgressPct)} derived`}
                </p>
                {rollup.averageProgressPct === null ? (
                  <p className="muted" style={{ fontSize: '0.72rem' }}>
                    No modules from this track are in your plan.
                  </p>
                ) : (
                  <ProgressBar
                    value={rollup.averageProgressPct}
                    label={`${rollup.name} derived track progress`}
                    tone="info"
                    size="sm"
                  />
                )}
                <p className="track-card__note">
                  Reference only — not your overall progress.
                  <span className="track-card__action">View details</span>
                </p>
              </button>
            )
          })}
        </div>

        <div className="panel" aria-live="polite">
          {selectedRollup ? (
            <>
              <div className="panel__header">
                <div>
                  <h3>{selectedRollup.name}</h3>
                  <p className="muted">
                    {selectedRollup.inPlanCount} of {selectedRollup.moduleCount} modules in plan ·{' '}
                    {selectedRollup.averageProgressPct === null
                      ? 'No estimate'
                      : `${formatPercent(selectedRollup.averageProgressPct)} derived progress`}
                  </p>
                </div>
                <Button variant="ghost" className="btn--sm" onClick={() => onSelectTrack(null)}>
                  Return to all tracks
                </Button>
              </div>
              <div className="track-module-list">
                {contributingModules.map((module) => (
                  <div className="track-module" key={module.moduleSlug}>
                    <div className="track-module__name">
                      <strong>{module.name}</strong>
                      <span>
                        {module.inPlan ? `${formatPercent(module.progressPct)} complete` : 'Not in your plan'}
                      </span>
                    </div>
                    <Button
                      variant="secondary"
                      className="btn--sm"
                      onClick={() => onOpenModule(module.moduleSlug)}
                    >
                      View Details
                    </Button>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <h3>Contributing modules</h3>
              <p className="muted">
                Select a track bar or card to see the modules that make up its derived progress.
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
