import { CATALOG_NOTE, getModuleBySlug, type Recommendation } from '@spd/shared'
import { useCoach } from '../../hooks/useCoach'
import { formatPercent } from '../../lib/format'
import { RECOMMENDATION_LABEL, SKILL_IMPORTANCE_LABEL } from '../../lib/status'
import { Spinner } from '../feedback/AsyncState'
import { Button } from '../ui/Button'
import { Drawer } from '../ui/Drawer'
import { StatusBadge } from '../ui/StatusBadge'

export type CoachContext = {
  type: 'general' | 'module' | 'skill' | 'career'
  label?: string
  moduleSlug?: string
  skillName?: string
  careerTitle?: string
}

type AiCoachDrawerProps = {
  context: CoachContext
  onClose: () => void
  onOpenModule: (slug: string) => void
}

function pickRecommendation(
  recommendations: Recommendation[],
  context: CoachContext,
): Recommendation | null {
  if (context.moduleSlug) {
    const match = recommendations.find((entry) => entry.moduleSlug === context.moduleSlug)
    if (match) return match
  }
  return recommendations[0] ?? null
}

export function AiCoachDrawer({ context, onClose, onOpenModule }: AiCoachDrawerProps) {
  const { state, reload } = useCoach()
  const recommendation = state.status === 'success' ? pickRecommendation(state.data.recommendations, context) : null
  const recommendationModule = recommendation ? getModuleBySlug(recommendation.moduleSlug) : undefined
  const contextModule = context.moduleSlug ? getModuleBySlug(context.moduleSlug) : undefined
  const focusModule = recommendationModule ?? contextModule
  const activities = focusModule?.skills.flatMap((skill) => skill.activityTemplates).slice(0, 4) ?? []
  const skills = focusModule?.skills.slice(0, 4) ?? []

  return (
    <Drawer
      title="AI Coach"
      eyebrow="Your learning coach"
      onClose={onClose}
      headerExtra={
        <p style={{ marginTop: 6 }}>
          <StatusBadge label="Preview only" tone="warning" />
        </p>
      }
    >
      <div className="drawer__section" role="note">
        <p>
          This is a clearly labeled preview. Recommendations use demo data and catalog activity
          templates; live personalized AI coaching is not connected yet.
        </p>
      </div>

      {context.type !== 'general' ? (
        <div>
          <span className="drawer__context">
            Context: {context.label ?? context.careerTitle ?? context.skillName ?? 'Selected item'}
          </span>
        </div>
      ) : null}

      {state.status === 'loading' ? (
        <div className="drawer__state" role="status" aria-live="polite">
          <Spinner />
          <p>Loading coach recommendations...</p>
        </div>
      ) : state.status === 'error' ? (
        <div className="drawer__state" role="alert">
          <h3>We could not load coach recommendations</h3>
          <p className="muted">{state.error.message}</p>
          <Button variant="secondary" onClick={reload}>
            Try again
          </Button>
        </div>
      ) : (
        <>
          <section className="drawer__section" aria-labelledby="coach-action-heading">
            <h3 id="coach-action-heading">Recommended next action</h3>
            {recommendation ? (
              <>
                <p>
                  <strong>{recommendation.title}</strong>
                </p>
                <p className="muted">{recommendation.reason}</p>
                <div className="coach-preview__meta">
                  <StatusBadge
                    label={RECOMMENDATION_LABEL[recommendation.type]}
                    tone="info"
                  />
                  {recommendation.estimatedMinutes ? (
                    <span>Estimated time: ~{recommendation.estimatedMinutes} min</span>
                  ) : null}
                  {recommendation.expectedGainPct !== null ? (
                    <span>Expected gain: {formatPercent(recommendation.expectedGainPct)}</span>
                  ) : null}
                </div>
              </>
            ) : (
              <p className="muted">
                No personalized recommendation is available for this context yet. The preview
                below shows catalog information only.
              </p>
            )}
          </section>

          <section className="drawer__section" aria-labelledby="coach-why-heading">
            <h3 id="coach-why-heading">Why this is relevant</h3>
            <p>
              {recommendation
                ? recommendation.reason
                : 'A live recommendation service will explain relevance using your module progress once it is connected.'}
            </p>
          </section>

          {context.type === 'career' ? (
            <section className="drawer__section" aria-labelledby="coach-career-heading">
              <h3 id="coach-career-heading">Career pathway context</h3>
              <p>
                Exploring <strong>{context.careerTitle ?? context.label ?? 'this pathway'}</strong>.
                Career coverage is based on estimated skill exposure from module progress. It is not
                a job-readiness score or a guarantee of employment.
              </p>
            </section>
          ) : null}

          {context.type === 'skill' ? (
            <section className="drawer__section" aria-labelledby="coach-skill-heading">
              <h3 id="coach-skill-heading">Skill context</h3>
              <p>
                <strong>{context.skillName ?? context.label}</strong> is estimated from the modules
                that introduce it. No verified proficiency assessment is available.
              </p>
            </section>
          ) : null}

          <section className="drawer__section" aria-labelledby="coach-skills-heading">
            <h3 id="coach-skills-heading">Skills involved</h3>
            {skills.length === 0 ? (
              <p className="muted">No catalog skills are mapped to this context.</p>
            ) : (
              <ul className="drawer__list">
                {skills.map((skill) => (
                  <li key={skill.id}>
                    {skill.name} · {SKILL_IMPORTANCE_LABEL[skill.importance]} · estimated
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="drawer__section" aria-labelledby="coach-activities-heading">
            <h3 id="coach-activities-heading">Suggested learning activities</h3>
            {activities.length === 0 ? (
              <p className="muted">No catalog activities are available for this context yet.</p>
            ) : (
              <ul className="drawer__list">
                {activities.map((activity) => (
                  <li key={`${activity.type}-${activity.title}`}>
                    {activity.title} · {activity.type} · {activity.minutes} min
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="drawer__section" aria-labelledby="coach-modules-heading">
            <h3 id="coach-modules-heading">Related modules</h3>
            {focusModule ? (
              <div className="drawer__actions">
                <Button
                  variant="secondary"
                  onClick={() => {
                    onOpenModule(focusModule.slug)
                    onClose()
                  }}
                >
                  Open {focusModule.name}
                </Button>
              </div>
            ) : (
              <p className="muted">Select a module to see related catalog modules.</p>
            )}
          </section>

          <p className="muted" style={{ fontSize: '0.74rem' }}>
            {CATALOG_NOTE}
          </p>
        </>
      )}
    </Drawer>
  )
}
