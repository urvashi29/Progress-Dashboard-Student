import {
  TRACKS,
  type DashboardModule,
  type DashboardResponse,
  type TrackSlug,
} from '@spd/shared'
import { useMemo, useState } from 'react'
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
import { formatDaysAgo, formatIsoDate, formatPercent, formatRatio } from '../../lib/format'
import { MODULE_BAND_LABEL, MODULE_BAND_TONE } from '../../lib/status'
import { Button } from '../ui/Button'
import { ChartTable } from '../ui/ChartTable'
import { ProgressBar } from '../ui/ProgressBar'
import { StatusBadge } from '../ui/StatusBadge'

type AnalyticsTabProps = {
  data: DashboardResponse
  onOpenModule: (slug: string) => void
}

function truncateLabel(value: string, maxLength = 28): string {
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength - 1)}…`
}

export function AnalyticsTab({ data, onOpenModule }: AnalyticsTabProps) {
  const [trackFilter, setTrackFilter] = useState<'all' | TrackSlug>('all')

  const comparisonRows = [
    { name: 'Your overall progress', progress: data.overallProgressPct },
    { name: 'Expected progress', progress: data.health.expectedPct },
  ]

  const moduleRows = useMemo(() => {
    return data.modules
      .filter((module) => module.inPlan)
      .filter((module) => trackFilter === 'all' || module.track === trackFilter)
      .sort((a, b) => a.catalogOrder - b.catalogOrder)
      .map((module) => ({
        name: truncateLabel(module.name),
        fullName: module.name,
        progress: module.progressPct,
        moduleSlug: module.moduleSlug,
      }))
  }, [data.modules, trackFilter])

  const attentionModules = data.modules
    .filter(
      (module) =>
        module.inPlan &&
        (module.band === 'NEEDS_ATTENTION' || module.band === 'NOT_STARTED'),
    )
    .sort((a, b) => a.catalogOrder - b.catalogOrder)

  return (
    <section className="tab-panel" aria-labelledby="analytics-tab-heading">
      <div className="section-heading">
        <h2 id="analytics-tab-heading">Analytics</h2>
        <p className="muted">
          A current snapshot from the progress API. No historical trend is invented when the API only
          supplies current values.
        </p>
      </div>

      <div className="analytics-grid">
        <figure className="card chart-card" aria-labelledby="overall-expected-heading">
          <figcaption>
            <h3 id="overall-expected-heading">Overall vs expected progress</h3>
            <p className="muted">
              Your authoritative platform progress next to the API’s expected pace for this cohort.
            </p>
          </figcaption>
          <div
            className="chart-canvas"
            role="img"
            aria-label="Bar chart comparing your overall progress with expected progress"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonRows} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_THEME.grid} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke={CHART_THEME.axis} interval={0} />
                <YAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} stroke={CHART_THEME.axis} width={38} />
                <Tooltip formatter={(value) => `${value}%`} />
                <Bar dataKey="progress" name="Progress" radius={[6, 6, 0, 0]} barSize={54}>
                  <Cell fill={CHART_THEME.primary} />
                  <Cell fill={CHART_THEME.reference} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ChartTable
            caption="Overall versus expected progress data"
            columns={['Measure', 'Progress']}
            rows={comparisonRows.map((row) => ({
              key: row.name,
              cells: [row.name, formatPercent(row.progress)],
            }))}
          />
        </figure>

        <section className="card pace-panel" aria-labelledby="pace-heading">
          <div className="panel__header">
            <div>
              <h3 id="pace-heading">Learning pace</h3>
              <p className="muted">Calculated by the backend from cohort dates and progress.</p>
            </div>
            <StatusBadge
              label={data.health.label}
              tone={
                data.health.status === 'ON_TRACK'
                  ? 'positive'
                  : data.health.status === 'CRITICAL'
                    ? 'danger'
                    : data.health.status === 'GETTING_STARTED'
                      ? 'neutral'
                      : 'warning'
              }
            />
          </div>

          <dl className="pace-metrics">
            <div className="pace-metrics__item">
              <dt>Current pace</dt>
              <dd>{data.health.label}</dd>
            </div>
            <div className="pace-metrics__item">
              <dt>Pace ratio</dt>
              <dd>
                {data.health.paceRatio === null ? 'Not available' : formatRatio(data.health.paceRatio)}
              </dd>
            </div>
            <div className="pace-metrics__item">
              <dt>Expected progress</dt>
              <dd>{formatPercent(data.health.expectedPct)}</dd>
            </div>
            <div className="pace-metrics__item">
              <dt>Last progress update</dt>
              <dd>
                {formatIsoDate(data.enrollment.progressUpdatedAt)}
                <span className="pace-metrics__sub">
                  ({formatDaysAgo(data.health.staleDays)})
                </span>
              </dd>
            </div>
          </dl>

          <ProgressBar
            value={data.health.expectedPct}
            label="Expected progress for this cohort"
            tone="neutral"
            size="sm"
          />

          <div className="pace-reasons">
            <h4>Why this status</h4>
            <ul>
              {data.health.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>
        </section>

        <figure className="card chart-card chart-card--wide" aria-labelledby="module-comparison-heading">
          <figcaption>
            <h3 id="module-comparison-heading">Module comparison</h3>
            <p className="muted">
              Completion for in-plan modules, filtered by track. Select a bar to open module details.
            </p>
          </figcaption>

          <div className="analytics-filter">
            <label htmlFor="analytics-track-filter">Track filter</label>
            <select
              id="analytics-track-filter"
              value={trackFilter}
              onChange={(event) =>
                setTrackFilter(event.target.value === 'all' ? 'all' : (event.target.value as TrackSlug))
              }
            >
              <option value="all">All tracks</option>
              {TRACKS.map((track) => (
                <option key={track.slug} value={track.slug}>
                  {track.name}
                </option>
              ))}
            </select>
          </div>

          {moduleRows.length === 0 ? (
            <div className="chart-empty">
              <div className="state-panel state-panel--empty">
                <h3>No module progress yet</h3>
                <p>Module progress will appear here once your plan includes modules for this filter.</p>
              </div>
            </div>
          ) : (
            <>
              <div
                className="chart-canvas chart-canvas--tall"
                role="img"
                aria-label="Horizontal bar chart comparing progress across modules"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={moduleRows}
                    layout="vertical"
                    margin={{ top: 8, right: 24, bottom: 8, left: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={CHART_THEME.grid} />
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      unit="%"
                      tick={{ fontSize: 11 }}
                      stroke={CHART_THEME.axis}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={176}
                      tick={{ fontSize: 11 }}
                      stroke={CHART_THEME.axis}
                    />
                    <Tooltip formatter={(value) => `${value}%`} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar
                      dataKey="progress"
                      name="Module progress"
                      fill={CHART_THEME.primary}
                      radius={[0, 6, 6, 0]}
                      barSize={13}
                      cursor="pointer"
                      onClick={(entry) => {
                        const payload = entry as { payload?: { moduleSlug?: string } }
                        if (payload.payload?.moduleSlug) onOpenModule(payload.payload.moduleSlug)
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <ChartTable
                caption="Module progress comparison data"
                columns={['Module', 'Progress']}
                rows={moduleRows.map((row) => ({
                  key: row.fullName,
                  cells: [row.fullName, formatPercent(row.progress)],
                }))}
              />
            </>
          )}
        </figure>

        <section className="card" aria-labelledby="attention-heading">
          <div className="panel__header">
            <div>
              <h3 id="attention-heading">Attention areas</h3>
              <p className="muted">In-plan modules that are not started or need attention.</p>
            </div>
          </div>
          {attentionModules.length === 0 ? (
            <p className="muted">No modules currently need attention.</p>
          ) : (
            <div className="attention-grid">
              {attentionModules.map((module: DashboardModule) => (
                <button
                  key={module.moduleSlug}
                  type="button"
                  className="attention-card"
                  onClick={() => onOpenModule(module.moduleSlug)}
                >
                  <span className="attention-card__name">
                    <strong>{module.name}</strong>
                    <span>
                      {TRACKS.find((track) => track.slug === module.track)?.name ?? module.track} ·{' '}
                      {formatPercent(module.progressPct)} complete
                    </span>
                  </span>
                  <StatusBadge
                    label={MODULE_BAND_LABEL[module.band]}
                    tone={MODULE_BAND_TONE[module.band]}
                  />
                </button>
              ))}
            </div>
          )}
          <Button
            variant="ghost"
            className="btn--sm"
            onClick={() => onOpenModule(attentionModules[0]?.moduleSlug ?? '')}
            disabled={attentionModules.length === 0}
            style={{ marginTop: 10 }}
          >
            Review first attention area
          </Button>
        </section>
      </div>
    </section>
  )
}
