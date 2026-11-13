import { TRACKS } from '@spd/shared'
import { Link } from 'react-router-dom'
import { useModuleDetail } from '../../hooks/useModuleDetail'
import { formatPercent } from '../../lib/format'
import { MODULE_BAND_LABEL, MODULE_BAND_TONE, SKILL_IMPORTANCE_LABEL } from '../../lib/status'
import { Spinner } from '../feedback/AsyncState'
import { Button } from '../ui/Button'
import { Drawer } from '../ui/Drawer'
import { ProgressBar } from '../ui/ProgressBar'
import { StatusBadge } from '../ui/StatusBadge'
import type { CoachContext } from './AiCoachDrawer'

type ModuleDetailDrawerProps = {
  slug: string
  onClose: () => void
  onOpenCoach: (context: CoachContext) => void
  onOpenSkillography: () => void
}

export function ModuleDetailDrawer({
  slug,
  onClose,
  onOpenCoach,
  onOpenSkillography,
}: ModuleDetailDrawerProps) {
  const { state, reload } = useModuleDetail(slug)

  if (state.status === 'loading') {
    return (
      <Drawer title="Module details" eyebrow="Loading" onClose={onClose} wide>
        <div className="drawer__state" role="status" aria-live="polite">
          <Spinner />
          <p>Loading module details...</p>
        </div>
      </Drawer>
    )
  }

  if (state.status === 'error') {
    return (
      <Drawer title="Module details" eyebrow="Unavailable" onClose={onClose} wide>
        <div className="drawer__state" role="alert">
          <h3>We could not load this module</h3>
          <p className="muted">{state.error.message}</p>
          <Button variant="secondary" onClick={reload}>
            Try again
          </Button>
        </div>
      </Drawer>
    )
  }

  const { module, catalog, prerequisites, suggestedActivities, caveat } = state.data
  const trackName = TRACKS.find((track) => track.slug === module.track)?.name ?? module.track
  const skillNames = catalog.skills.map((skill) => skill.name).join(', ')

  return (
    <Drawer
      title={module.name}
      eyebrow={trackName}
      onClose={onClose}
      wide
      headerExtra={
        <p style={{ marginTop: 6 }}>
          <StatusBadge label={MODULE_BAND_LABEL[module.band]} tone={MODULE_BAND_TONE[module.band]} />
        </p>
      }
    >
      <section className="drawer__section" aria-labelledby="drawer-progress-heading">
        <h3 id="drawer-progress-heading">Current progress</h3>
        {module.inPlan ? (
          <>
            <p>
              <strong>{formatPercent(module.progressPct)}</strong> complete ·{' '}
              {MODULE_BAND_LABEL[module.band]}
            </p>
            <ProgressBar
              value={module.progressPct}
              label={`${module.name} progress`}
              tone="info"
            />
          </>
        ) : (
          <p className="muted">
            This module is not included in your current plan. That is different from an assigned
            module at 0%.
          </p>
        )}
      </section>

      <section className="drawer__section" aria-labelledby="drawer-focus-heading">
        <h3 id="drawer-focus-heading">Curriculum focus</h3>
        <p>
          This module is part of the <strong>{trackName}</strong> track and introduces{' '}
          <strong>{skillNames}</strong>.
        </p>
      </section>

      <section className="drawer__section" aria-labelledby="drawer-skills-heading">
        <h3 id="drawer-skills-heading">Associated skills (estimated)</h3>
        <ul className="drawer__list">
          {catalog.skills.map((skill) => (
            <li key={skill.id}>
              <strong>{skill.name}</strong> · {SKILL_IMPORTANCE_LABEL[skill.importance]} ·{' '}
              {Math.round(skill.weight * 100)}% catalog weight. {skill.description}
            </li>
          ))}
        </ul>
      </section>

      <section className="drawer__section" aria-labelledby="drawer-prereq-heading">
        <h3 id="drawer-prereq-heading">Prerequisites</h3>
        {prerequisites.length === 0 ? (
          <p className="muted">No prerequisite modules are defined for this module.</p>
        ) : (
          <ul className="drawer__list">
            {prerequisites.map((prerequisite) => (
              <li key={prerequisite.moduleSlug}>
                <Link to={`/modules/${prerequisite.moduleSlug}`}>{prerequisite.name}</Link>
                {prerequisite.inPlan
                  ? ` · ${formatPercent(prerequisite.progressPct ?? 0)} complete`
                  : ' · not in your plan'}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="drawer__section" aria-labelledby="drawer-activities-heading">
        <h3 id="drawer-activities-heading">Suggested learning activities</h3>
        {suggestedActivities.length === 0 ? (
          <p className="muted">No catalog activities are available for this module yet.</p>
        ) : (
          <ul className="drawer__list">
            {suggestedActivities.map((activity) => (
              <li key={activity.title}>
                {activity.title} · {activity.type} · {activity.minutes} min
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="drawer__actions">
        <Button
          onClick={() =>
            onOpenCoach({
              type: 'module',
              label: module.name,
              moduleSlug: module.moduleSlug,
            })
          }
        >
          Explore with AI Coach
        </Button>
        <Button variant="secondary" onClick={onOpenSkillography}>
          View in Skillography
        </Button>
        <Link className="btn btn--ghost" to={`/modules/${module.moduleSlug}`}>
          Open full module page
        </Link>
      </div>

      <p className="muted" style={{ fontSize: '0.74rem' }}>
        {caveat}
      </p>
    </Drawer>
  )
}
