import {
  TRACKS,
  getModuleBySlug,
  type DashboardModule,
  type DashboardResponse,
  type TrackRollup,
  type TrackSlug,
} from '@spd/shared'
import type { AsyncResource } from '../../hooks/useDashboard'
import type { SkillographyBundle } from '../../hooks/useSkillography'
import { formatPercent, formatRatio } from '../../lib/format'
import { MODULE_BAND_LABEL, MODULE_BAND_TONE } from '../../lib/status'
import type { DashboardTabId } from '../../lib/tabs'
import { Button } from '../ui/Button'
import { ProgressBar } from '../ui/ProgressBar'
import { StatusBadge } from '../ui/StatusBadge'

type OverviewTabProps = {
  data: DashboardResponse
  skillography: AsyncResource<SkillographyBundle>
  onNavigateTab: (tab: DashboardTabId) => void
  onOpenCoach: () => void
  onOpenModule: (slug: string) => void
  onSelectTrack: (track: TrackSlug) => void
}

function SummaryIcon({ name }: { name: 'progress' | 'modules' | 'pace' | 'skills' }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }

  if (name === 'progress') {
    return (
      <svg {...common}>
        <path d="M3 13a9 9 0 1 0 9-9" />
        <path d="M12 12l4-4" />
      </svg>
    )
  }
  if (name === 'modules') {
    return (
      <svg {...common}>
        <path d="M4 5h16v14H4z" />
        <path d="M4 10h16" />
        <path d="M9 5v14" />
      </svg>
    )
  }
  if (name === 'pace') {
    return (
      <svg {...common}>
        <path d="M3 17l5-6 4 3 4-7 5 4" />
        <path d="M3 21h18" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5z" />
    </svg>
  )
}

function SummaryCard({
  icon,
  label,
  value,
  hint,
  onClick,
}: {
  icon: 'progress' | 'modules' | 'pace' | 'skills'
  label: string
  value: string
  hint: string
  onClick?: () => void
}) {
  const content = (
    <>
      <div className="summary-card__top">
        <span className="summary-card__icon">
          <SummaryIcon name={icon} />
        </span>
      </div>
      <span className="summary-card__value">{value}</span>
      <span className="summary-card__label">{label}</span>
      <span className="summary-card__hint">{hint}</span>
    </>
  )

  if (onClick) {
    return (
      <button type="button" className="summary-card" onClick={onClick}>
        {content}
      </button>
    )
  }

  return <div className="summary-card">{content}</div>
}

function ContinueCard({
  module,
  onOpen,
}: {
  module: DashboardModule
  onOpen: (slug: string) => void
}) {
  const catalog = getModuleBySlug(module.moduleSlug)
  const trackName = TRACKS.find((track) => track.slug === module.track)?.name ?? module.track

  return (
    <article className="continue-card" aria-label={module.name}>
      <div className="continue-card__top">
        <div>
          <p className="continue-card__track">{trackName}</p>
          <h3>{module.name}</h3>
        </div>
        <StatusBadge label={MODULE_BAND_LABEL[module.band]} tone={MODULE_BAND_TONE[module.band]} />
      </div>
      <div className="module-row__progress-label">
        <span>Progress</span>
        <strong>{formatPercent(module.progressPct)}</strong>
      </div>
      <ProgressBar
        value={module.progressPct}
        label={`${module.name} progress`}
        tone="info"
        size="sm"
      />
      {catalog ? (
        <div className="continue-card__skills" aria-label={`${module.name} associated skills`}>
          {catalog.skills.slice(0, 3).map((skill) => (
            <span className="skill-chip" key={skill.id}>
              {skill.name}
            </span>
          ))}
        </div>
      ) : null}
      <div className="continue-card__actions">
        <Button variant="secondary" className="btn--sm" onClick={() => onOpen(module.moduleSlug)}>
          View Module
        </Button>
      </div>
    </article>
  )
}

export function OverviewTab({
  data,
  skillography,
  onNavigateTab,
  onOpenCoach,
  onOpenModule,
  onSelectTrack,
}: OverviewTabProps) {
  const inPlanModules = data.modules.filter((module) => module.inPlan)
  const completed = inPlanModules.filter((module) => module.progressPct >= 100).length
  const incomplete = inPlanModules
    .filter((module) => module.progressPct < 100)
    .sort((a, b) => a.catalogOrder - b.catalogOrder)
    .slice(0, 3)

  const skills =
    skillography.status === 'success'
      ? skillography.data.skillography.skills
      : []
  const introducedSkills = skills.filter((skill) => skill.status !== 'NOT_IN_PLAN').length

  const orderedTracks: TrackRollup[] = TRACKS.map((track) =>
    data.tracks.find((rollup) => rollup.track === track.slug),
  ).filter((rollup): rollup is TrackRollup => Boolean(rollup))

  const nextStep = data.coachSummary.recommendations[0] ?? null

  return (
    <>
      <div className="summary-grid">
        <SummaryCard
          icon="progress"
          label="Overall progress"
          value={formatPercent(data.overallProgressPct)}
          hint="Authoritative platform value"
          onClick={() => onNavigateTab('analytics')}
        />
        <SummaryCard
          icon="modules"
          label="Modules completed"
          value={`${completed}/${inPlanModules.length}`}
          hint={`${inPlanModules.length} modules in your plan`}
          onClick={() => onNavigateTab('modules')}
        />
        <SummaryCard
          icon="pace"
          label="Learning pace"
          value={data.health.label}
          hint={
            data.health.paceRatio === null
              ? 'Not enough cohort time to judge yet'
              : `${formatRatio(data.health.paceRatio)} of expected pace`
          }
          onClick={() => onNavigateTab('analytics')}
        />
        <SummaryCard
          icon="skills"
          label="Estimated skills"
          value={skillography.status === 'success' ? String(introducedSkills) : '—'}
          hint="Introduced by your in-plan modules"
          onClick={() => onNavigateTab('skillography')}
        />
      </div>

      <div className="overview-grid">
        <div className="overview-stack">
          <section className="panel" aria-labelledby="continue-heading">
            <div className="panel__header">
              <div>
                <h2 id="continue-heading">Continue learning</h2>
                <p className="muted">
                  Three incomplete modules in curated catalog order. Recommendations are not ranked
                  until a recommendation service supplies priorities.
                </p>
              </div>
              <button
                type="button"
                className="panel__link"
                onClick={() => onNavigateTab('modules')}
              >
                View all modules
              </button>
            </div>
            {incomplete.length === 0 ? (
              <p className="muted">You have no incomplete modules in your current plan.</p>
            ) : (
              <div className="continue-grid">
                {incomplete.map((module) => (
                  <ContinueCard key={module.moduleSlug} module={module} onOpen={onOpenModule} />
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="overview-stack">
          <section className="panel" aria-labelledby="snapshot-heading">
            <div className="panel__header">
              <div>
                <h2 id="snapshot-heading">Learning track snapshot</h2>
                <p className="muted">Derived averages, not your overall progress.</p>
              </div>
              <button
                type="button"
                className="panel__link"
                onClick={() => onNavigateTab('tracks')}
              >
                Compare tracks
              </button>
            </div>
            <div className="track-snapshot">
              {orderedTracks.map((rollup) => (
                <button
                  key={rollup.track}
                  type="button"
                  className="track-snapshot__row"
                  onClick={() => onSelectTrack(rollup.track)}
                  aria-label={`View ${rollup.name} track`}
                >
                  <span className="track-snapshot__meta">
                    <strong>{rollup.name}</strong>
                    <span>
                      {rollup.inPlanCount}/{rollup.moduleCount} in plan ·{' '}
                      {rollup.averageProgressPct === null
                        ? 'No estimate'
                        : formatPercent(rollup.averageProgressPct)}
                    </span>
                  </span>
                  {rollup.averageProgressPct === null ? (
                    <span className="muted" style={{ fontSize: '0.72rem' }}>
                      No modules from this track are in your plan.
                    </span>
                  ) : (
                    <ProgressBar
                      value={rollup.averageProgressPct}
                      label={`${rollup.name} derived track progress`}
                      tone="info"
                      size="sm"
                    />
                  )}
                </button>
              ))}
            </div>
          </section>

          <section className="coach-preview" aria-labelledby="next-step-heading">
            <div className="panel__header">
              <div>
                <p className="eyebrow">AI Coach preview</p>
                <h2 id="next-step-heading">Your Next Learning Step</h2>
              </div>
              <StatusBadge label="Preview only" tone="warning" />
            </div>
            {nextStep ? (
              <>
                <p>
                  <strong>{nextStep.title}</strong>
                </p>
                <p className="coach-preview__reason">{nextStep.reason}</p>
                <div className="coach-preview__meta">
                  {nextStep.estimatedMinutes ? (
                    <span>~{nextStep.estimatedMinutes} min</span>
                  ) : null}
                  <span>Recommendations use demo data, not live AI output.</span>
                </div>
              </>
            ) : (
              <p className="coach-preview__reason">
                A personalized recommendation is not available yet. The coach preview explains what
                will appear when the service is connected.
              </p>
            )}
            <div className="coach-preview__actions">
              <Button onClick={onOpenCoach}>Explore with AI Coach</Button>
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
