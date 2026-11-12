import {
  TRACKS,
  type DashboardResponse,
  type TrackRollup,
} from '@spd/shared'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatPercent } from '../../lib/format'
import { EmptyState } from '../feedback/AsyncState'
import { ChartTable } from '../ui/ChartTable'

function truncateLabel(value: string, maxLength = 26): string {
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength - 1)}…`
}

export function AnalyticsPanel({ data }: { data: DashboardResponse }) {
  const inPlanModules = data.modules
    .filter((module) => module.inPlan)
    .sort((a, b) => a.catalogOrder - b.catalogOrder)

  const moduleRows = inPlanModules.map((module) => ({
    name: truncateLabel(module.name),
    fullName: module.name,
    progress: module.progressPct,
  }))

  const orderedTracks: TrackRollup[] = TRACKS.map((track) =>
    data.tracks.find((rollup) => rollup.track === track.slug),
  ).filter((rollup): rollup is TrackRollup => Boolean(rollup))

  const trackRows = orderedTracks
    .filter((rollup) => rollup.averageProgressPct !== null)
    .map((rollup) => ({
      name: rollup.name,
      fullName: rollup.name,
      progress: rollup.averageProgressPct ?? 0,
    }))

  const comparisonRows = [
    { name: 'Your overall progress', progress: data.overallProgressPct },
    { name: 'Expected progress', progress: data.health.expectedPct },
  ]

  return (
    <section className="section" aria-labelledby="analytics-heading">
      <div className="section-heading">
        <h2 id="analytics-heading">Analytics</h2>
        <p className="muted">
          These charts show the current snapshot provided by the API. No historical trend is
          invented when the API only supplies current values.
        </p>
      </div>

      <div className="analytics-grid">
        <figure className="card chart-card chart-card--wide" aria-labelledby="chart-modules-heading">
          <figcaption>
            <h3 id="chart-modules-heading">Module progress comparison</h3>
            <p className="muted">
              Progress for the {moduleRows.length} modules in your plan, in curated catalog order.
            </p>
          </figcaption>
          {moduleRows.length === 0 ? (
            <div className="chart-empty">
              <EmptyState
                title="No module progress yet"
                message="Module progress will appear here once your plan includes modules."
              />
            </div>
          ) : (
            <>
              <div
                className="chart-canvas chart-canvas--tall"
                role="img"
                aria-label="Horizontal bar chart comparing progress across your modules"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={moduleRows}
                    layout="vertical"
                    margin={{ top: 8, right: 24, bottom: 8, left: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      unit="%"
                      tick={{ fontSize: 12 }}
                      stroke="#94a3b8"
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={172}
                      tick={{ fontSize: 12 }}
                      stroke="#94a3b8"
                    />
                    <Tooltip />
                    <Bar
                      dataKey="progress"
                      name="Progress"
                      fill="#2563eb"
                      radius={[0, 6, 6, 0]}
                      barSize={14}
                      unit="%"
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

        <figure className="card chart-card" aria-labelledby="chart-tracks-heading">
          <figcaption>
            <h3 id="chart-tracks-heading">Learning track comparison</h3>
            <p className="muted">
              Derived averages across your four tracks. Reference only — not your overall progress.
            </p>
          </figcaption>
          {trackRows.length === 0 ? (
            <div className="chart-empty">
              <EmptyState
                title="No track progress yet"
                message="Track averages appear when modules are included in your plan."
              />
            </div>
          ) : (
            <>
              <div
                className="chart-canvas"
                role="img"
                aria-label="Horizontal bar chart comparing derived progress across learning tracks"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={trackRows}
                    layout="vertical"
                    margin={{ top: 8, right: 24, bottom: 8, left: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      unit="%"
                      tick={{ fontSize: 12 }}
                      stroke="#94a3b8"
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={132}
                      tick={{ fontSize: 12 }}
                      stroke="#94a3b8"
                    />
                    <Tooltip />
                    <Bar
                      dataKey="progress"
                      name="Track average"
                      fill="#0f766e"
                      radius={[0, 6, 6, 0]}
                      barSize={18}
                      unit="%"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <ChartTable
                caption="Learning track comparison data"
                columns={['Track', 'Derived progress']}
                rows={trackRows.map((row) => ({
                  key: row.fullName,
                  cells: [row.fullName, formatPercent(row.progress)],
                }))}
              />
            </>
          )}
        </figure>

        <figure className="card chart-card" aria-labelledby="chart-overall-heading">
          <figcaption>
            <h3 id="chart-overall-heading">Overall vs expected progress</h3>
            <p className="muted">
              Your platform-reported overall progress next to the API’s expected pace for this
              cohort.
            </p>
          </figcaption>
          <div
            className="chart-canvas"
            role="img"
            aria-label="Bar chart comparing your overall progress with expected progress"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={comparisonRows}
                layout="vertical"
                margin={{ top: 8, right: 24, bottom: 8, left: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  unit="%"
                  tick={{ fontSize: 12 }}
                  stroke="#94a3b8"
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={150}
                  tick={{ fontSize: 12 }}
                  stroke="#94a3b8"
                />
                <Tooltip />
                <Bar dataKey="progress" name="Progress" radius={[0, 6, 6, 0]} barSize={26} unit="%">
                  <Cell fill="#2563eb" />
                  <Cell fill="#94a3b8" />
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
      </div>
    </section>
  )
}
