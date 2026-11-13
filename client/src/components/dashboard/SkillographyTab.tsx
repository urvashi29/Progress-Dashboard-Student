import {
  TRACKS,
  getSkillById,
  type CareerPathMatch,
  type SkillExposure,
  type SkillographyResponse,
  type TrackSlug,
} from '@spd/shared'
import { useState } from 'react'
import type { AsyncResource } from '../../hooks/useDashboard'
import type { SkillographyBundle } from '../../hooks/useSkillography'
import { formatPercent } from '../../lib/format'
import {
  CAREER_STAGE_TONE,
  SKILL_IMPORTANCE_LABEL,
  SKILL_STATUS_LABEL,
  SKILL_STATUS_TONE,
} from '../../lib/status'
import { Button } from '../ui/Button'
import { ProgressBar } from '../ui/ProgressBar'
import { Spinner } from '../feedback/AsyncState'
import { StatusBadge } from '../ui/StatusBadge'
import type { CoachContext } from './AiCoachDrawer'

type SkillographyTabProps = {
  state: AsyncResource<SkillographyBundle>
  reload: () => void
  onOpenCoach: (context: CoachContext) => void
  onOpenModule: (slug: string) => void
}

type Subview = 'skills' | 'modules' | 'careers'

function exposureTone(skill: SkillExposure) {
  if (skill.status === 'STRONG_EXPOSURE') return 'positive' as const
  if (skill.status === 'IN_PROGRESS') return 'info' as const
  if (skill.status === 'UNAVAILABLE') return 'warning' as const
  return 'muted' as const
}

function skillTrackLabel(skill: SkillExposure): string {
  const track = skill.moduleAssociations[0]?.track
  return TRACKS.find((entry) => entry.slug === track)?.name ?? 'Unmapped track'
}

function SkillRow({
  skill,
  selected,
  onSelect,
}: {
  skill: SkillExposure
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      className="skill-row"
      aria-pressed={selected}
      onClick={onSelect}
    >
      <div className="skill-row__top">
        <div>
          <strong>{skill.name}</strong>
          <p className="muted" style={{ fontSize: '0.72rem' }}>
            {SKILL_IMPORTANCE_LABEL[skill.importance]} · {skillTrackLabel(skill)}
          </p>
        </div>
        <StatusBadge label={SKILL_STATUS_LABEL[skill.status]} tone={SKILL_STATUS_TONE[skill.status]} />
      </div>
      {skill.estimatedExposurePct === null ? (
        <p className="muted" style={{ fontSize: '0.72rem' }}>
          {skill.limitation}
        </p>
      ) : (
        <>
          <div className="skill-row__meta">
            <span>Estimated skill exposure</span>
            <strong>{formatPercent(skill.estimatedExposurePct)}</strong>
          </div>
          <ProgressBar
            value={skill.estimatedExposurePct}
            label={`${skill.name} estimated exposure`}
            tone={exposureTone(skill)}
            size="sm"
          />
        </>
      )}
      <span className="muted" style={{ fontSize: '0.68rem' }}>
        {skill.moduleAssociations.length} supporting module
        {skill.moduleAssociations.length === 1 ? '' : 's'} · low confidence
      </span>
    </button>
  )
}

function SkillDetail({
  skill,
  onOpenCoach,
  onOpenModule,
}: {
  skill: SkillExposure
  onOpenCoach: (context: CoachContext) => void
  onOpenModule: (slug: string) => void
}) {
  const prerequisites = skill.prerequisiteSkillIds
    .map((skillId) => getSkillById(skillId))
    .filter((entry): entry is NonNullable<typeof entry> => entry !== undefined)

  return (
    <div className="skill-detail" aria-labelledby="skill-detail-heading">
      <div>
        <p className="eyebrow">Skill-to-module explorer</p>
        <h3 id="skill-detail-heading">{skill.name}</h3>
        <p className="muted" style={{ fontSize: '0.8rem', marginTop: 4 }}>
          {skill.description}
        </p>
      </div>

      <div className="skill-detail__section">
        <h4>Estimated skill exposure</h4>
        {skill.estimatedExposurePct === null ? (
          <p className="muted">{skill.limitation}</p>
        ) : (
          <>
            <div className="skill-row__meta">
              <span>Estimated from in-plan modules</span>
              <strong>{formatPercent(skill.estimatedExposurePct)}</strong>
            </div>
            <ProgressBar
              value={skill.estimatedExposurePct}
              label={`${skill.name} estimated exposure`}
              tone={exposureTone(skill)}
            />
          </>
        )}
        <p className="muted" style={{ fontSize: '0.72rem' }}>
          {skill.confidenceLabel} This is curriculum coverage, not verified proficiency.
        </p>
      </div>

      <div className="skill-detail__section">
        <h4>Related modules</h4>
        <div className="skill-detail__modules">
          {skill.moduleAssociations.map((association) => (
            <div className="skill-detail__module" key={association.moduleSlug}>
              <div>
                <strong>{association.moduleName}</strong>
                <p className="muted" style={{ fontSize: '0.7rem' }}>
                  {association.inPlan
                    ? `${formatPercent(association.progressPct ?? 0)} complete`
                    : 'Not in your plan'}{' '}
                  · {Math.round(association.weight * 100)}% weight
                </p>
              </div>
              <Button
                variant="ghost"
                className="btn--sm"
                onClick={() => onOpenModule(association.moduleSlug)}
              >
                View module
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="skill-detail__section">
        <h4>Prerequisite skills</h4>
        {prerequisites.length === 0 ? (
          <p className="muted">No prerequisite skills are listed for this skill.</p>
        ) : (
          <ul className="skill-detail__list">
            {prerequisites.map((entry) => (
              <li key={entry.id}>{entry.name}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="skill-detail__section">
        <h4>Suggested learning activities</h4>
        {skill.practiceActivities.length === 0 ? (
          <p className="muted">No practice activities are listed yet.</p>
        ) : (
          <ul className="skill-detail__list">
            {skill.practiceActivities.map((activity) => (
              <li key={`${activity.type}-${activity.title}`}>
                {activity.title} · {activity.type} · {activity.minutes} min
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="skill-detail__section">
        <h4>Portfolio evidence idea</h4>
        {skill.portfolioEvidence.length === 0 ? (
          <p className="muted">No portfolio evidence idea is listed yet.</p>
        ) : (
          <ul className="skill-detail__list">
            {skill.portfolioEvidence.map((evidence) => (
              <li key={evidence}>{evidence}</li>
            ))}
          </ul>
        )}
      </div>

      <Button
        onClick={() =>
          onOpenCoach({ type: 'skill', label: skill.name, skillName: skill.name })
        }
      >
        Explore with AI Coach
      </Button>
    </div>
  )
}

function CareerDetail({
  career,
  onOpenCoach,
  onOpenModule,
}: {
  career: CareerPathMatch
  onOpenCoach: (context: CoachContext) => void
  onOpenModule: (slug: string) => void
}) {
  return (
    <div className="career-detail" aria-labelledby="career-detail-heading">
      <div>
        <p className="eyebrow">Career pathway</p>
        <h3 id="career-detail-heading">{career.title}</h3>
        <p className="muted" style={{ fontSize: '0.8rem', marginTop: 4 }}>
          {career.description}
        </p>
      </div>

      <div className="career-card__coverage-label">
        <span>Curriculum coverage · estimated</span>
        <strong>{formatPercent(career.estimatedCoveragePct)}</strong>
      </div>
      <ProgressBar
        value={career.estimatedCoveragePct}
        label={`${career.title} estimated curriculum coverage`}
        tone={CAREER_STAGE_TONE[career.stage]}
      />
      <p className="muted" style={{ fontSize: '0.72rem' }}>
        Coverage is the average estimated exposure of required skills. It is not a job-readiness
        score.
      </p>

      <div className="career-detail__section">
        <h4>Related skills</h4>
        <ul className="career-skill-list">
          {career.requiredSkills.map((skill) => (
            <li className="career-skill" key={skill.skillId}>
              <span className="career-skill__name">{skill.name}</span>
              <span className="career-skill__meta">
                {skill.estimatedExposurePct === null
                  ? 'No estimate'
                  : `${formatPercent(skill.estimatedExposurePct)} estimated`}
                <StatusBadge
                  label={SKILL_STATUS_LABEL[skill.status]}
                  tone={SKILL_STATUS_TONE[skill.status]}
                />
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="career-detail__section">
        <h4>Missing competencies</h4>
        {career.missingCompetencies.length === 0 ? (
          <p className="muted">
            All required skills have strong estimated exposure. Portfolio and assessment evidence
            are still needed to demonstrate them.
          </p>
        ) : (
          <ul className="career-missing-list">
            {career.missingCompetencies.map((competency) => (
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
                  <div className="drawer__actions" style={{ paddingTop: 6 }}>
                    {competency.suggestedModuleSlugs.map((slug) => (
                      <Button
                        key={slug}
                        variant="ghost"
                        className="btn--sm"
                        onClick={() => onOpenModule(slug)}
                      >
                        View {slug.replace(/-/g, ' ')}
                      </Button>
                    ))}
                  </div>
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

      <div className="career-detail__section">
        <h4>Suggested projects</h4>
        <ul className="career-detail__list">
          {career.suggestedProjects.map((project) => (
            <li key={project}>{project}</li>
          ))}
        </ul>
      </div>

      <div className="career-detail__section">
        <h4>Portfolio evidence</h4>
        <ul className="career-detail__list">
          {career.portfolioEvidence.map((evidence) => (
            <li key={evidence}>{evidence}</li>
          ))}
        </ul>
      </div>

      <div className="career-detail__section">
        <h4>Recommended next learning activities</h4>
        {career.nextLearningActivities.length === 0 ? (
          <p className="muted">No specific activities are flagged yet.</p>
        ) : (
          <ul className="career-detail__list">
            {career.nextLearningActivities.map((activity) => (
              <li key={`${activity.skillId}-${activity.title}`}>
                {activity.title} · {activity.type} · {activity.minutes} min
                {activity.moduleName ? ` · ${activity.moduleName}` : ''}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="career-detail__section">
        <h4>Pathway limitations</h4>
        <ul className="career-detail__list">
          {career.limitations.map((limitation) => (
            <li key={limitation}>{limitation}</li>
          ))}
        </ul>
      </div>

      <Button
        onClick={() =>
          onOpenCoach({
            type: 'career',
            label: career.title,
            careerTitle: career.title,
          })
        }
      >
        Explore this pathway with AI Coach
      </Button>

      <p className="career-detail__note">{career.pathwayNote}</p>
    </div>
  )
}

export function SkillographyTab({ state, reload, onOpenCoach, onOpenModule }: SkillographyTabProps) {
  const [subview, setSubview] = useState<Subview>('skills')
  const [query, setQuery] = useState('')
  const [trackFilter, setTrackFilter] = useState<'all' | TrackSlug>('all')
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null)
  const [selectedCareerSlug, setSelectedCareerSlug] = useState<string | null>(null)

  if (state.status === 'loading') {
    return (
      <section className="tab-panel" aria-labelledby="skillography-heading">
        <div className="section-heading">
          <h2 id="skillography-heading">Skillography</h2>
          <p className="muted">Estimated skill exposure and career pathway exploration.</p>
        </div>
        <div className="drawer__state" role="status" aria-live="polite">
          <Spinner />
          <p>Loading your skill insights...</p>
        </div>
      </section>
    )
  }

  if (state.status === 'error') {
    return (
      <section className="tab-panel" aria-labelledby="skillography-heading">
        <div className="section-heading">
          <h2 id="skillography-heading">Skillography</h2>
        </div>
        <div className="state-panel state-panel--error" role="alert">
          <h3>We could not load your skill insights</h3>
          <p>{state.error.message}</p>
          <Button variant="secondary" onClick={reload}>
            Try again
          </Button>
        </div>
      </section>
    )
  }

  const skillography: SkillographyResponse = state.data.skillography
  const careerPaths = state.data.careerPaths.careerPaths
  const selectedSkill = skillography.skills.find((skill) => skill.skillId === selectedSkillId) ?? null
  const selectedCareer =
    careerPaths.find((career) => career.slug === selectedCareerSlug) ?? null

  const normalizedQuery = query.trim().toLowerCase()
  const filteredSkills = skillography.skills.filter((skill) => {
    if (
      trackFilter !== 'all' &&
      !skill.moduleAssociations.some((association) => association.track === trackFilter)
    ) {
      return false
    }
    if (!normalizedQuery) return true
    const moduleText = skill.moduleAssociations.map((association) => association.moduleName).join(' ')
    return `${skill.name} ${moduleText}`.toLowerCase().includes(normalizedQuery)
  })

  const skillList = (
    <div className="skill-list-panel">
      <div className="skill-search">
        <div className="field-inline">
          <label htmlFor="skill-search">Search skills</label>
          <input
            id="skill-search"
            type="search"
            placeholder="Search skills or modules"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="field-inline">
          <label htmlFor="skill-track-filter">Track</label>
          <select
            id="skill-track-filter"
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
      </div>

      {filteredSkills.length === 0 ? (
        <p className="muted">No skills match your search or track filter.</p>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {filteredSkills.map((skill) => (
            <SkillRow
              key={skill.skillId}
              skill={skill}
              selected={selectedSkillId === skill.skillId}
              onSelect={() => {
                setSelectedSkillId(skill.skillId)
                setSubview('modules')
              }}
            />
          ))}
        </div>
      )}
    </div>
  )

  return (
    <section className="tab-panel skillography-tab" aria-labelledby="skillography-heading">
      <div className="section-heading">
        <h2 id="skillography-heading">Skillography</h2>
        <p className="muted">
          Explore the skills your curriculum introduces, the modules behind them, and career
          pathways you could investigate next.
        </p>
      </div>

      <div className="skillography-notice" role="note">
        <strong>Module completion is not proficiency.</strong> Skill exposure is estimated from your
        module progress. Verified skill proficiency is unavailable until assessment evidence is
        recorded. Career pathways are suggestions to explore, never a guarantee of employment.
      </div>

      <div className="subview-tabs" role="tablist" aria-label="Skillography views">
        <button
          type="button"
          role="tab"
          className="subview-tab"
          aria-selected={subview === 'skills'}
          aria-controls="skillography-skills-panel"
          onClick={() => setSubview('skills')}
        >
          My Skills
        </button>
        <button
          type="button"
          role="tab"
          className="subview-tab"
          aria-selected={subview === 'modules'}
          aria-controls="skillography-modules-panel"
          onClick={() => setSubview('modules')}
        >
          Skill-to-Module Explorer
        </button>
        <button
          type="button"
          role="tab"
          className="subview-tab"
          aria-selected={subview === 'careers'}
          aria-controls="skillography-careers-panel"
          onClick={() => setSubview('careers')}
        >
          Career Path Explorer
        </button>
      </div>

      {subview === 'skills' ? (
        <div id="skillography-skills-panel" role="tabpanel" aria-label="My Skills">
          {skillList}
        </div>
      ) : null}

      {subview === 'modules' ? (
        <div
          id="skillography-modules-panel"
          role="tabpanel"
          aria-label="Skill-to-Module Explorer"
          className="skillography-layout"
        >
          {skillList}
          {selectedSkill ? (
            <SkillDetail
              skill={selectedSkill}
              onOpenCoach={onOpenCoach}
              onOpenModule={onOpenModule}
            />
          ) : (
            <div className="panel">
              <h3>Select a skill</h3>
              <p className="muted">
                Choose a skill from the list to see its related modules, completion, prerequisites
                and suggested activities.
              </p>
            </div>
          )}
        </div>
      ) : null}

      {subview === 'careers' ? (
        <div id="skillography-careers-panel" role="tabpanel" aria-label="Career Path Explorer">
          <div className="career-grid">
            {careerPaths.map((career) => (
              <button
                key={career.slug}
                type="button"
                className="career-card"
                aria-pressed={selectedCareerSlug === career.slug}
                onClick={() =>
                  setSelectedCareerSlug(selectedCareerSlug === career.slug ? null : career.slug)
                }
              >
                <div className="career-card__header">
                  <div>
                    <h3>{career.title}</h3>
                    <p className="muted">{career.description}</p>
                  </div>
                  <StatusBadge
                    label={career.stageLabel}
                    tone={CAREER_STAGE_TONE[career.stage]}
                  />
                </div>
                <div className="career-card__coverage-label">
                  <span>Curriculum coverage · estimated</span>
                  <strong>{formatPercent(career.estimatedCoveragePct)}</strong>
                </div>
                <ProgressBar
                  value={career.estimatedCoveragePct}
                  label={`${career.title} estimated curriculum coverage`}
                  tone={CAREER_STAGE_TONE[career.stage]}
                  size="sm"
                />
                <p className="muted" style={{ fontSize: '0.7rem' }}>
                  {career.requiredSkills.length} required skills ·{' '}
                  {career.missingCompetencies.length} need attention
                </p>
              </button>
            ))}
          </div>

          {selectedCareer ? (
            <div style={{ marginTop: 14 }}>
              <CareerDetail
                career={selectedCareer}
                onOpenCoach={onOpenCoach}
                onOpenModule={onOpenModule}
              />
            </div>
          ) : (
            <p className="muted" style={{ marginTop: 12 }}>
              Select a pathway to see related skills, missing competencies, projects and suggested
              activities.
            </p>
          )}
        </div>
      ) : null}

      <p className="muted" style={{ fontSize: '0.72rem' }}>
        {skillography.methodology}
      </p>
    </section>
  )
}
