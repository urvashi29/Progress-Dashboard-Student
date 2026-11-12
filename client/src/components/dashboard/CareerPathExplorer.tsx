import type { CareerPathListResponse, CareerPathMatch, CareerSkill } from '@spd/shared'
import { Link } from 'react-router-dom'
import { formatPercent } from '../../lib/format'
import { CAREER_STAGE_TONE, SKILL_STATUS_LABEL, SKILL_STATUS_TONE } from '../../lib/status'
import { ProgressBar } from '../ui/ProgressBar'
import { StatusBadge } from '../ui/StatusBadge'

function SkillRow({ skill }: { skill: CareerSkill }) {
  return (
    <li className="career-skill">
      <span className="career-skill__name">{skill.name}</span>
      <span className="career-skill__meta">
        {skill.estimatedExposurePct === null
          ? 'No estimate yet'
          : `${formatPercent(skill.estimatedExposurePct)} estimated exposure`}
        <StatusBadge
          label={SKILL_STATUS_LABEL[skill.status]}
          tone={SKILL_STATUS_TONE[skill.status]}
        />
      </span>
    </li>
  )
}

function CareerPathCard({ careerPath }: { careerPath: CareerPathMatch }) {
  return (
    <article className="career-card card" aria-label={careerPath.title}>
      <div className="career-card__header">
        <div>
          <h3>{careerPath.title}</h3>
          <p className="muted">{careerPath.description}</p>
        </div>
        <StatusBadge
          label={careerPath.stageLabel}
          tone={CAREER_STAGE_TONE[careerPath.stage]}
        />
      </div>

      <div className="career-card__coverage">
        <div className="career-card__coverage-label">
          <span>Curriculum coverage · estimated</span>
          <strong>{formatPercent(careerPath.estimatedCoveragePct)}</strong>
        </div>
        <ProgressBar
          value={careerPath.estimatedCoveragePct}
          label={`${careerPath.title} estimated curriculum coverage`}
          tone={CAREER_STAGE_TONE[careerPath.stage]}
        />
        <p className="muted career-card__hint">
          Coverage is the average estimated exposure of the required skills, not a
          job-readiness score.
        </p>
      </div>

      <div className="career-card__section">
        <h4>Required skills</h4>
        <ul className="career-skill-list">
          {careerPath.requiredSkills.map((skill) => (
            <SkillRow key={skill.skillId} skill={skill} />
          ))}
        </ul>
      </div>

      <div className="career-card__section">
        <h4>Missing skills and next steps</h4>
        {careerPath.missingCompetencies.length === 0 ? (
          <p className="muted">
            All required skills have strong estimated exposure. Portfolio and assessment
            evidence are still needed to demonstrate them.
          </p>
        ) : (
          <ul className="career-missing-list">
            {careerPath.missingCompetencies.map((competency) => (
              <li key={competency.skillId}>
                <div className="career-missing__head">
                  <strong>{competency.name}</strong>
                  <StatusBadge
                    label={SKILL_STATUS_LABEL[competency.status]}
                    tone={SKILL_STATUS_TONE[competency.status]}
                  />
                </div>
                <p className="muted">{competency.reason}</p>
                {competency.suggestedModuleSlugs.length > 0 ? (
                  <p className="career-missing__modules">
                    Related module:{' '}
                    {competency.suggestedModuleSlugs.map((slug, index) => (
                      <span key={slug}>
                        {index > 0 ? ', ' : null}
                        <Link to={`/modules/${slug}`}>{slug.replace(/-/g, ' ')}</Link>
                      </span>
                    ))}
                  </p>
                ) : null}
                {competency.portfolioEvidence[0] ? (
                  <p className="career-missing__evidence">
                    Portfolio idea: {competency.portfolioEvidence[0]}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {careerPath.helpfulSkills.length > 0 ? (
        <details className="career-card__details">
          <summary>Helpful skills to explore</summary>
          <ul className="career-skill-list">
            {careerPath.helpfulSkills.map((skill) => (
              <SkillRow key={skill.skillId} skill={skill} />
            ))}
          </ul>
        </details>
      ) : null}

      <details className="career-card__details">
        <summary>Suggested projects and portfolio evidence</summary>
        <ul className="career-card__list">
          {careerPath.suggestedProjects.map((project) => (
            <li key={project}>{project}</li>
          ))}
        </ul>
        <ul className="career-card__list">
          {careerPath.portfolioEvidence.map((evidence) => (
            <li key={evidence}>{evidence}</li>
          ))}
        </ul>
      </details>

      <details className="career-card__details">
        <summary>Recommended next learning activities</summary>
        {careerPath.nextLearningActivities.length === 0 ? (
          <p className="muted">
            No specific activities are flagged yet. Browse the skill practice areas above.
          </p>
        ) : (
          <ul className="career-card__list">
            {careerPath.nextLearningActivities.map((activity) => (
              <li key={`${activity.skillId}-${activity.title}`}>
                {activity.title} · {activity.type} · {activity.minutes} min
                {activity.moduleName ? (
                  <span className="muted"> · {activity.moduleName}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </details>

      <details className="career-card__details">
        <summary>Pathway limitations</summary>
        <ul className="career-card__list">
          {careerPath.limitations.map((limitation) => (
            <li key={limitation}>{limitation}</li>
          ))}
        </ul>
      </details>

      <div className="career-card__explanation">
        <h4>Why this pathway appears</h4>
        <ul>
          {careerPath.explanation.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>

      <p className="career-card__note">{careerPath.pathwayNote}</p>
    </article>
  )
}

export function CareerPathExplorer({ data }: { data: CareerPathListResponse }) {
  return (
    <section className="section" aria-labelledby="career-explorer-heading">
      <div className="section-heading">
        <h3 id="career-explorer-heading">Career Path Explorer</h3>
        <p className="muted">
          These pathways are starting points to explore, not a verdict on your ability or a
          promise of employment. Use the missing skills and projects as practical next steps.
        </p>
      </div>
      <div className="career-grid">
        {data.careerPaths.map((careerPath) => (
          <CareerPathCard key={careerPath.slug} careerPath={careerPath} />
        ))}
      </div>
      <p className="muted skillography__methodology">{data.methodology}</p>
    </section>
  )
}
