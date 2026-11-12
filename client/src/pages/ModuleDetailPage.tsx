import { TRACKS } from '@spd/shared'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { PageError, PageLoading } from '../components/feedback/AsyncState'
import { LearningPlanDialog } from '../components/module/LearningPlanDialog'
import { Button } from '../components/ui/Button'
import { ProgressBar } from '../components/ui/ProgressBar'
import { StatusBadge } from '../components/ui/StatusBadge'
import { useModuleDetail } from '../hooks/useModuleDetail'
import { formatPercent } from '../lib/format'
import { MODULE_BAND_LABEL, MODULE_BAND_TONE, SKILL_IMPORTANCE_LABEL } from '../lib/status'

export function ModuleDetailPage() {
  const params = useParams<{ slug: string }>()
  const slug = params.slug ?? ''
  const { state, reload } = useModuleDetail(slug)
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [planOpen, setPlanOpen] = useState(false)

  if (state.status === 'loading') {
    return <PageLoading label="Loading module details..." />
  }

  if (state.status === 'error') {
    if (state.error.isUnauthorized) {
      async function handleSignInAgain() {
        await logout()
        navigate('/login', { replace: true })
      }

      return (
        <PageError
          title="Your session has expired"
          message="For your security, please sign in again to view this module."
          actionLabel="Sign in again"
          onAction={() => void handleSignInAgain()}
        />
      )
    }

    if (state.error.isNotFound) {
      return (
        <PageError
          title="Module not found"
          message="We could not find this module in the catalog. It may have been renamed or removed."
          secondary={
            <Link className="btn btn--primary" to="/dashboard">
              Back to dashboard
            </Link>
          }
        />
      )
    }

    return (
      <PageError
        title="We could not load this module"
        message={state.error.message}
        actionLabel="Try again"
        onAction={reload}
        secondary={
          <Link className="btn btn--ghost" to="/dashboard">
            Back to dashboard
          </Link>
        }
      />
    )
  }

  const { module, catalog, prerequisites, suggestedActivities, confidence } = state.data
  const trackName = TRACKS.find((track) => track.slug === module.track)?.name ?? module.track
  const remaining = module.inPlan ? Math.max(0, 100 - module.progressPct) : null
  const bandTone = MODULE_BAND_TONE[module.band]

  return (
    <div className="page-stack">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/dashboard">Progress Dashboard</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{module.name}</span>
      </nav>

      <header className="page-header module-detail__header">
        <p className="eyebrow">{trackName}</p>
        <h1>{module.name}</h1>
        <div className="module-detail__badges">
          <StatusBadge label={MODULE_BAND_LABEL[module.band]} tone={bandTone} />
          <span className="muted">Module {catalog.catalogOrder} in the curated catalog</span>
        </div>
      </header>

      <div className="detail-grid">
        <section className="card detail-card" aria-labelledby="module-progress-heading">
          <h2 id="module-progress-heading">Current progress</h2>
          {module.inPlan ? (
            <>
              <p className="detail-progress__value">{formatPercent(module.progressPct)}</p>
              <ProgressBar
                value={module.progressPct}
                label={`${module.name} progress`}
                tone={bandTone}
                size="lg"
              />
              <p className="muted">
                Status: {MODULE_BAND_LABEL[module.band]}. This progress value comes from your
                enrollment record.
              </p>
            </>
          ) : (
            <div className="detail-not-in-plan">
              <StatusBadge label="Not in Plan" tone="muted" />
              <p>
                This module is not part of your current enrollment. It is not shown as a 0%
                completed assigned module.
              </p>
            </div>
          )}
        </section>

        <section className="card detail-card" aria-labelledby="prerequisites-heading">
          <h2 id="prerequisites-heading">Prerequisite modules</h2>
          {prerequisites.length === 0 ? (
            <p className="muted">No prerequisite modules are defined for this module.</p>
          ) : (
            <ul className="prereq-list">
              {prerequisites.map((prerequisite) => (
                <li key={prerequisite.moduleSlug}>
                  <div className="prereq-list__name">
                    <Link to={`/modules/${prerequisite.moduleSlug}`}>{prerequisite.name}</Link>
                    <span className="muted">
                      {prerequisite.inPlan
                        ? `${formatPercent(prerequisite.progressPct ?? 0)} complete`
                        : 'Not in your plan'}
                    </span>
                  </div>
                  {prerequisite.band ? (
                    <StatusBadge
                      label={MODULE_BAND_LABEL[prerequisite.band]}
                      tone={MODULE_BAND_TONE[prerequisite.band]}
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card detail-card" aria-labelledby="skills-heading">
        <div className="section-heading">
          <h2 id="skills-heading">Estimated skills</h2>
          <p className="muted">
            Estimated from module progress · {confidence} confidence. These skills have not been
            directly assessed.
          </p>
        </div>
        <ul className="skill-list">
          {catalog.skills.map((skill) => (
            <li key={skill.name}>
              <div>
                <h3>{skill.name}</h3>
                <p className="muted">
                  {SKILL_IMPORTANCE_LABEL[skill.importance]} · catalog weight{' '}
                  {Math.round(skill.weight * 100)}%
                </p>
              </div>
              <StatusBadge label="Estimated" tone="neutral" />
            </li>
          ))}
        </ul>
      </section>

      <section className="card detail-card" aria-labelledby="activities-heading">
        <div className="section-heading">
          <h2 id="activities-heading">Suggested learning activities</h2>
          <p className="muted">
            Catalog activity templates, not a personalized plan. A recommendation engine will
            personalize these in a later phase.
          </p>
        </div>
        {suggestedActivities.length === 0 ? (
          <p className="muted">No catalog activities are available for this module yet.</p>
        ) : (
          <ul className="activity-list">
            {suggestedActivities.map((activity) => (
              <li key={activity.title}>
                <span>{activity.title}</span>
                <span className="muted">
                  {activity.type} · {activity.minutes} min
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="learning-plan" className="card cta-card" aria-labelledby="fast-plan-heading">
        <div>
          <p className="eyebrow">Next step</p>
          <h2 id="fast-plan-heading">How to Complete This Module Faster</h2>
          <p className="muted">
            Open a clearly labeled preview. Personalized fast-completion plans are not available in
            this phase.
          </p>
        </div>
        <Button onClick={() => setPlanOpen(true)}>How to Complete This Module Faster</Button>
      </section>

      <LearningPlanDialog
        open={planOpen}
        onClose={() => setPlanOpen(false)}
        moduleName={module.name}
        remainingPct={remaining}
        activities={suggestedActivities}
      />
    </div>
  )
}
