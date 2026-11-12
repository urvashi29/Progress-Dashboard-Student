import { CATALOG_NOTE, getModuleBySlug, type CoachSummary } from '@spd/shared'
import { Link } from 'react-router-dom'
import { RECOMMENDATION_LABEL, SKILL_IMPORTANCE_LABEL } from '../../lib/status'
import { EmptyState } from '../feedback/AsyncState'
import { StatusBadge } from '../ui/StatusBadge'

export function CoachPanel({ summary }: { summary: CoachSummary }) {
  return (
    <section className="coach-panel" aria-labelledby="coach-heading">
      <div className="coach-panel__header">
        <div>
          <p className="eyebrow">Preview</p>
          <h2 id="coach-heading">Your AI Skill Coach</h2>
        </div>
        <StatusBadge label="Preview only" tone="warning" />
      </div>

      <p className="coach-panel__disclaimer" role="note">
        These recommendations come from clearly labeled mock data in this phase. They are not live
        AI output.
      </p>

      {summary.recommendations.length === 0 ? (
        <EmptyState
          title="No recommendations yet"
          message="Personalized recommendations will appear here when the coach API is available."
        />
      ) : (
        <>
          <p className="coach-panel__headline">{summary.headline}</p>
          <ul className="coach-grid">
            {summary.recommendations.map((recommendation) => {
              const catalogModule = getModuleBySlug(recommendation.moduleSlug)
              const skills = catalogModule?.skills.slice(0, 2) ?? []
              const activity = catalogModule?.skills.flatMap((skill) => skill.activityTemplates)[0]

              return (
                <li key={recommendation.id} className="card recommendation-card">
                  <div className="recommendation-card__top">
                    <StatusBadge
                      label={RECOMMENDATION_LABEL[recommendation.type]}
                      tone="info"
                    />
                    {recommendation.estimatedMinutes === null ? null : (
                      <span className="recommendation-card__time">
                        ~{recommendation.estimatedMinutes} min
                      </span>
                    )}
                  </div>

                  <h3>{recommendation.title}</h3>
                  <p>{recommendation.reason}</p>

                  {skills.length > 0 ? (
                    <div className="recommendation-card__skills">
                      <h4>
                        Estimated skills{' '}
                        <span className="muted">estimated from module progress</span>
                      </h4>
                      <ul>
                        {skills.map((skill) => (
                          <li key={skill.name}>
                            {skill.name} · {SKILL_IMPORTANCE_LABEL[skill.importance]} · low
                            confidence
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {activity ? (
                    <p className="recommendation-card__activity">
                      <strong>Suggested activity:</strong> {activity.title} ({activity.minutes}{' '}
                      min)
                    </p>
                  ) : null}

                  <p className="recommendation-card__caveat">{CATALOG_NOTE}</p>

                  <Link
                    className="btn btn--secondary"
                    to={`/modules/${recommendation.moduleSlug}#learning-plan`}
                  >
                    View learning plan
                  </Link>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}
