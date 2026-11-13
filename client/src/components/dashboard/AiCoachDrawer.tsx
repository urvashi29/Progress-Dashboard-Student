import {
  CAREER_PATHS,
  CATALOG_NOTE,
  findSkillByName,
  getModuleBySlug,
  getSkillById,
  type CoachRecommendation,
  type CoachSummary,
} from '@spd/shared'
import { useState, type FormEvent } from 'react'
import { useAskCoach, useCoach, useModuleGuide } from '../../hooks/useCoach'
import { formatPercent } from '../../lib/format'
import { RECOMMENDATION_LABEL, SKILL_IMPORTANCE_LABEL } from '../../lib/status'
import { Spinner } from '../feedback/AsyncState'
import { Button } from '../ui/Button'
import { Drawer } from '../ui/Drawer'
import { ProgressBar } from '../ui/ProgressBar'
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

function orderRecommendations(
  recommendations: CoachRecommendation[],
  context: CoachContext,
): CoachRecommendation[] {
  if (!context.moduleSlug) return recommendations
  const index = recommendations.findIndex((entry) => entry.moduleSlug === context.moduleSlug)
  if (index <= 0) return recommendations
  const copy = recommendations.slice()
  const [match] = copy.splice(index, 1)
  return match ? [match, ...copy] : recommendations
}

function focusRecommendation(
  recommendations: CoachRecommendation[],
  context: CoachContext,
): CoachRecommendation | null {
  if (context.moduleSlug) {
    const match = recommendations.find((entry) => entry.moduleSlug === context.moduleSlug)
    if (match) return match
  }
  return recommendations[0] ?? null
}

function actionLabel(recommendation: CoachRecommendation): string {
  return recommendation.action === 'CONTINUE_MODULE' ? 'Continue Module' : 'View Module'
}

function GeneratedByBadge({ generatedBy }: { generatedBy: CoachSummary['generatedBy'] }) {
  return (
    <StatusBadge
      label={generatedBy === 'gemini' ? 'Gemini explanation' : 'Deterministic fallback'}
      tone={generatedBy === 'gemini' ? 'info' : 'neutral'}
    />
  )
}

function RecommendationCard({
  recommendation,
  onOpenModule,
  onGuide,
}: {
  recommendation: CoachRecommendation
  onOpenModule: (slug: string) => void
  onGuide: (slug: string) => void
}) {
  return (
    <article className="coach-rec" aria-label={recommendation.moduleName}>
      <div className="coach-rec__top">
        <div>
          <StatusBadge
            label={RECOMMENDATION_LABEL[recommendation.type]}
            tone="info"
          />
          <h4>{recommendation.title}</h4>
        </div>
      </div>

      <p className="coach-rec__explanation">{recommendation.explanation}</p>

      <div className="coach-rec__progress">
        <span>
          Module progress <strong>{formatPercent(recommendation.progressPct)}</strong>
        </span>
        <ProgressBar
          value={recommendation.progressPct}
          label={`${recommendation.moduleName} progress`}
          tone="info"
          size="sm"
        />
      </div>

      {recommendation.skills.length > 0 ? (
        <div className="coach-rec__skills" aria-label={`${recommendation.moduleName} skills`}>
          {recommendation.skills.map((skill) => (
            <span
              className="skill-chip"
              key={skill.id}
              title={SKILL_IMPORTANCE_LABEL[skill.importance]}
            >
              {skill.name}
            </span>
          ))}
        </div>
      ) : null}

      <div className="coach-rec__actions">
        <Button
          variant="secondary"
          className="btn--sm"
          onClick={() => onOpenModule(recommendation.moduleSlug)}
        >
          {actionLabel(recommendation)}
        </Button>
        <Button
          variant="ghost"
          className="btn--sm"
          onClick={() => onGuide(recommendation.moduleSlug)}
        >
          How to Complete This Module
        </Button>
      </div>
    </article>
  )
}

export function AiCoachDrawer({ context, onClose, onOpenModule }: AiCoachDrawerProps) {
  const { state, reload } = useCoach()
  const guide = useModuleGuide()
  const ask = useAskCoach()
  const [guideSlug, setGuideSlug] = useState<string | null>(null)
  const [question, setQuestion] = useState('')

  const recommendations =
    state.status === 'success'
      ? orderRecommendations(state.data.recommendations, context)
      : []
  const focus = focusRecommendation(recommendations, context)
  const contextModule = context.moduleSlug ? getModuleBySlug(context.moduleSlug) : undefined
  const contextSkill = context.skillName ? findSkillByName(context.skillName) : undefined
  const contextCareer = context.careerTitle
    ? CAREER_PATHS.find((career) => career.title === context.careerTitle)
    : undefined
  const careerModules =
    contextCareer?.moduleSlugs
      .map((slug) => getModuleBySlug(slug))
      .filter((module): module is NonNullable<typeof module> => module !== undefined) ?? []
  const skillModules =
    contextSkill?.moduleAssociations
      .map((association) => getModuleBySlug(association.moduleSlug))
      .filter((module): module is NonNullable<typeof module> => module !== undefined) ?? []
  const relatedModules = contextSkill ? skillModules : careerModules
  const contextSkills = contextSkill
    ? [{ id: contextSkill.id, name: contextSkill.name, importance: contextSkill.importance }]
    : contextCareer
      ? contextCareer.requiredSkillIds
          .map((skillId) => getSkillById(skillId))
          .filter((skill): skill is NonNullable<typeof skill> => skill !== undefined)
          .slice(0, 4)
      : []

  function loadGuide(slug: string) {
    setGuideSlug(slug)
    guide.load(slug)
  }

  function handleAsk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = question.trim()
    if (!trimmed) return
    ask.ask(trimmed, focus?.moduleSlug ?? context.moduleSlug)
  }

  return (
    <Drawer
      title="AI Coach"
      eyebrow="Your learning coach"
      onClose={onClose}
      headerExtra={
        state.status === 'success' ? (
          <p style={{ marginTop: 6 }}>
            <GeneratedByBadge generatedBy={state.data.generatedBy} />
          </p>
        ) : null
      }
    >
      <div className="drawer__section coach-note" role="note">
        <p>
          Recommendations use your actual module completion percentages and the approved
          curriculum mapping. Gemini explains the recommendations; it does not choose them or
          inspect quiz, coding-question or assessment results.
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
            <h3 id="coach-action-heading">Recommended next modules</h3>
            <p className="coach-headline">{state.data.headline}</p>
            {recommendations.length === 0 ? (
              <p className="muted">
                No incomplete module recommendations are available for your current plan.
              </p>
            ) : (
              <div className="coach-rec-list">
                {recommendations.map((recommendation) => (
                  <RecommendationCard
                    key={recommendation.id}
                    recommendation={recommendation}
                    onOpenModule={(slug) => {
                      onOpenModule(slug)
                      onClose()
                    }}
                    onGuide={loadGuide}
                  />
                ))}
              </div>
            )}
          </section>

          {recommendations.length > 0 ? (
            <section className="drawer__section" aria-labelledby="coach-guide-heading">
              <h3 id="coach-guide-heading">How to Complete This Module</h3>
              {guideSlug === null ? (
                <p className="muted">
                  Select “How to Complete This Module” on a recommendation to get short guidance
                  based on verified module information.
                </p>
              ) : guide.state.status === 'loading' ? (
                <div className="drawer__state" role="status" aria-live="polite">
                  <Spinner />
                  <p>Loading module guidance...</p>
                </div>
              ) : guide.state.status === 'error' ? (
                <div className="drawer__state" role="alert">
                  <h3>We could not load guidance</h3>
                  <p className="muted">{guide.state.error.message}</p>
                  <Button variant="secondary" onClick={() => guide.load(guideSlug)}>
                    Try again
                  </Button>
                </div>
              ) : guide.state.status === 'success' ? (
                <div className="coach-guide">
                  <div className="coach-guide__meta">
                    <strong>{guide.state.data.moduleName}</strong>
                    <StatusBadge
                      label={
                        guide.state.data.generatedBy === 'gemini'
                          ? 'Gemini guidance'
                          : 'Deterministic fallback'
                      }
                      tone={guide.state.data.generatedBy === 'gemini' ? 'info' : 'neutral'}
                    />
                  </div>
                  <ul className="drawer__list">
                    {guide.state.data.guidance.map((entry) => (
                      <li key={entry}>{entry}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>
          ) : null}

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

          {contextSkills.length > 0 ? (
            <section className="drawer__section" aria-labelledby="coach-skills-heading">
              <h3 id="coach-skills-heading">Skills involved</h3>
              <ul className="drawer__list">
                {contextSkills.map((skill) => (
                  <li key={skill.id}>
                    {skill.name} · {SKILL_IMPORTANCE_LABEL[skill.importance]} · estimated
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {contextModule &&
          !recommendations.some((entry) => entry.moduleSlug === contextModule.slug) ? (
            <section className="drawer__section" aria-labelledby="coach-context-module-heading">
              <h3 id="coach-context-module-heading">Selected module</h3>
              <p>
                <strong>{contextModule.name}</strong> is not in the current three recommendations.
              </p>
              <div className="drawer__actions">
                <Button variant="ghost" onClick={() => loadGuide(contextModule.slug)}>
                  How to Complete This Module
                </Button>
              </div>
            </section>
          ) : null}

          <section className="drawer__section" aria-labelledby="coach-ask-heading">
            <h3 id="coach-ask-heading">Ask AI Coach</h3>
            <form className="coach-ask" onSubmit={handleAsk}>
              <label htmlFor="coach-question">
                Ask about your next step{focus ? ` for ${focus.moduleName}` : ''}
              </label>
              <div className="coach-ask__row">
                <input
                  id="coach-question"
                  type="text"
                  maxLength={500}
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="What should I focus on next?"
                />
                <Button
                  type="submit"
                  className="btn--sm"
                  disabled={!question.trim() || ask.state.status === 'loading'}
                >
                  Ask
                </Button>
              </div>
            </form>
            {ask.state.status === 'loading' ? (
              <div className="drawer__state" role="status" aria-live="polite">
                <Spinner />
                <p>Asking the coach...</p>
              </div>
            ) : ask.state.status === 'error' ? (
              <div className="drawer__state" role="alert">
                <p className="muted">{ask.state.error.message}</p>
                <Button
                  variant="secondary"
                  onClick={() =>
                    ask.ask(question.trim(), focus?.moduleSlug ?? context.moduleSlug)
                  }
                >
                  Try again
                </Button>
              </div>
            ) : ask.state.status === 'success' ? (
              <div className="coach-answer" role="status">
                <p>{ask.state.data.answer}</p>
                <GeneratedByBadge generatedBy={ask.state.data.generatedBy} />
              </div>
            ) : null}
          </section>

          <section className="drawer__section" aria-labelledby="coach-assessment-heading">
            <h3 id="coach-assessment-heading">Assessments and activities</h3>
            <p>{state.data.assessmentData.note}</p>
            <p className="muted" style={{ fontSize: '0.74rem' }}>
              {state.data.disclaimer}
            </p>
          </section>

          {relatedModules.length > 0 ? (
            <section className="drawer__section" aria-labelledby="coach-modules-heading">
              <h3 id="coach-modules-heading">Related modules</h3>
              <div className="drawer__actions">
                {relatedModules.map((module) => (
                  <Button
                    key={module.slug}
                    variant="secondary"
                    onClick={() => {
                      onOpenModule(module.slug)
                      onClose()
                    }}
                  >
                    Open {module.name}
                  </Button>
                ))}
              </div>
            </section>
          ) : null}

          <p className="muted" style={{ fontSize: '0.74rem' }}>
            {CATALOG_NOTE}
          </p>
        </>
      )}
    </Drawer>
  )
}
