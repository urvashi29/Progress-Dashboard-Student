import type {
  CareerPathListResponse,
  SkillExposure,
  SkillographyResponse,
} from '@spd/shared'
import { Link } from 'react-router-dom'
import { useSkillography } from '../../hooks/useSkillography'
import { formatPercent } from '../../lib/format'
import {
  MODULE_BAND_LABEL,
  MODULE_BAND_TONE,
  SKILL_IMPORTANCE_LABEL,
  SKILL_STATUS_LABEL,
  SKILL_STATUS_TONE,
} from '../../lib/status'
import { Button } from '../ui/Button'
import { ProgressBar } from '../ui/ProgressBar'
import { StatusBadge } from '../ui/StatusBadge'
import { CareerPathExplorer } from './CareerPathExplorer'
import { Spinner } from '../feedback/AsyncState'

function exposureTone(skill: SkillExposure) {
  if (skill.status === 'STRONG_EXPOSURE') return 'positive' as const
  if (skill.status === 'IN_PROGRESS') return 'info' as const
  if (skill.status === 'UNAVAILABLE') return 'warning' as const
  return 'muted' as const
}

function SkillExposureRow({ skill }: { skill: SkillExposure }) {
  return (
    <li className="skill-exposure">
      <div className="skill-exposure__head">
        <div>
          <h4>{skill.name}</h4>
          <p className="muted">{SKILL_IMPORTANCE_LABEL[skill.importance]}</p>
        </div>
        <StatusBadge
          label={SKILL_STATUS_LABEL[skill.status]}
          tone={SKILL_STATUS_TONE[skill.status]}
        />
      </div>

      {skill.estimatedExposurePct === null ? (
        <p className="muted skill-exposure__note">{skill.limitation}</p>
      ) : (
        <div className="skill-exposure__progress">
          <div className="skill-exposure__label">
            <span>Estimated skill exposure</span>
            <strong>{formatPercent(skill.estimatedExposurePct)}</strong>
          </div>
          <ProgressBar
            value={skill.estimatedExposurePct}
            label={`${skill.name} estimated exposure`}
            tone={exposureTone(skill)}
            size="sm"
          />
        </div>
      )}

      {skill.evidenceSources.length > 0 ? (
        <p className="muted skill-exposure__note">
          {`Inferred from ${skill.evidenceSources.length} in-plan module${
            skill.evidenceSources.length === 1 ? '' : 's'
          }. ${skill.confidenceLabel} ${skill.limitation}`}
        </p>
      ) : null}
    </li>
  )
}

function SkillsByTrack({ data }: { data: SkillographyResponse }) {
  const skillsById = new Map(data.skills.map((skill) => [skill.skillId, skill]))

  return (
    <section className="section" aria-labelledby="skills-by-track-heading">
      <div className="section-heading">
        <h3 id="skills-by-track-heading">Skills by learning track</h3>
        <p className="muted">
          Estimate = progress-weighted average of the in-plan modules linked to each skill.
          This is not verified proficiency.
        </p>
      </div>
      <div className="track-grid">
        {data.tracks.map((track) => {
          const skills = track.skillIds
            .map((skillId) => skillsById.get(skillId))
            .filter((skill): skill is SkillExposure => skill !== undefined)

          return (
            <article className="track-card card" key={track.track} aria-label={track.name}>
              <div className="track-card__header">
                <h3>{track.name}</h3>
                <span className="track-card__count">
                  {track.inPlanSkillCount}/{track.skillCount} skills in plan
                </span>
              </div>
              <p className="track-card__plan">
                Track average estimate:{' '}
                <strong>
                  {track.averageExposurePct === null
                    ? 'No estimate yet'
                    : formatPercent(track.averageExposurePct)}
                </strong>
              </p>
              {skills.length === 0 ? (
                <p className="muted track-card__empty">
                  No skills are mapped to this track yet.
                </p>
              ) : (
                <ul className="skill-exposure-list">
                  {skills.map((skill) => (
                    <SkillExposureRow key={skill.skillId} skill={skill} />
                  ))}
                </ul>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}

function PracticeAreas({ data }: { data: SkillographyResponse }) {
  return (
    <section className="section" aria-labelledby="practice-areas-heading">
      <div className="section-heading">
        <h3 id="practice-areas-heading">Areas for additional practice</h3>
        <p className="muted">
          These are suggestions, not judgements. Pick one small activity and build from there.
        </p>
      </div>
      {data.practiceAreas.length === 0 ? (
        <p className="muted">
          No practice areas are flagged yet. Keep going and revisit this section as your
          modules progress.
        </p>
      ) : (
        <div className="practice-grid">
          {data.practiceAreas.slice(0, 6).map((area) => (
            <article className="practice-card card" key={area.skillId}>
              <div className="practice-card__head">
                <h4>{area.name}</h4>
                <StatusBadge
                  label={SKILL_STATUS_LABEL[area.status]}
                  tone={SKILL_STATUS_TONE[area.status]}
                />
              </div>
              <p className="muted">{area.reason}</p>
              {area.practiceActivities.length > 0 ? (
                <ul className="practice-card__list">
                  {area.practiceActivities.map((activity) => (
                    <li key={`${activity.title}-${activity.type}`}>
                      {activity.title} · {activity.type} · {activity.minutes} min
                    </li>
                  ))}
                </ul>
              ) : null}
              {area.portfolioEvidence[0] ? (
                <p className="practice-card__evidence">
                  Portfolio idea: {area.portfolioEvidence[0]}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

function ModuleSkillMap({ data }: { data: SkillographyResponse }) {
  return (
    <section className="section" aria-labelledby="module-skill-map-heading">
      <div className="section-heading">
        <h3 id="module-skill-map-heading">Module-to-skill map</h3>
        <p className="muted">
          Every curated module skill, with the module progress that supports it.
        </p>
      </div>
      <div className="table-scroll">
        <table className="skill-map-table" aria-label="Module to skill mapping data">
          <caption className="visually-hidden">
            Module progress and the skills associated with each module
          </caption>
          <thead>
            <tr>
              <th scope="col">Module</th>
              <th scope="col">Plan and progress</th>
              <th scope="col">Curated skills</th>
            </tr>
          </thead>
          <tbody>
            {data.modules.map((module) => (
              <tr key={module.moduleSlug}>
                <th scope="row">
                  <Link to={`/modules/${module.moduleSlug}`}>{module.name}</Link>
                  <span className="muted skill-map__track">{module.track}</span>
                </th>
                <td>
                  <div className="skill-map__plan">
                    <StatusBadge
                      label={MODULE_BAND_LABEL[module.band]}
                      tone={MODULE_BAND_TONE[module.band]}
                    />
                    <span className="muted">
                      {module.inPlan
                        ? `${formatPercent(module.progressPct)} complete`
                        : 'Not included in your current plan'}
                    </span>
                  </div>
                </td>
                <td>
                  <ul className="skill-map__skills">
                    {module.skills.map((skill) => (
                      <li key={skill.skillId}>
                        <span className="skill-chip">{skill.name}</span>
                        <span className="muted">
                          {' '}
                          {Math.round(skill.weight * 100)}% weight
                        </span>
                      </li>
                    ))}
                  </ul>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Limitations({ data }: { data: SkillographyResponse }) {
  return (
    <aside className="skillography__limitations" aria-label="Skillography limitations">
      <h4>How to read these estimates</h4>
      <ul>
        {data.limitations.map((limitation) => (
          <li key={limitation}>{limitation}</li>
        ))}
      </ul>
    </aside>
  )
}

type SkillographyGridProps = {
  skillography: SkillographyResponse
  careerPaths: CareerPathListResponse
}

export function SkillographyContent({ skillography, careerPaths }: SkillographyGridProps) {
  return (
    <div className="skillography__body">
      <SkillsByTrack data={skillography} />
      <PracticeAreas data={skillography} />
      <ModuleSkillMap data={skillography} />
      <CareerPathExplorer data={careerPaths} />
      <Limitations data={skillography} />
      <p className="muted skillography__methodology">{skillography.methodology}</p>
    </div>
  )
}

export function SkillographySection() {
  const { state, reload } = useSkillography()

  return (
    <section className="skillography" aria-labelledby="skillography-heading">
      <div className="skillography__header">
        <div>
          <h2 id="skillography-heading">Skillography &amp; career pathways</h2>
          <p className="muted">
            See which skills your modules introduce, how much exposure you have, and which
            pathways you could explore next.
          </p>
        </div>
        <StatusBadge label="Estimated, not assessed" tone="warning" />
      </div>

      <div className="skillography__notice" role="note">
        <strong>Module completion is not proficiency.</strong> Skill exposure is estimated
        from your module progress. Verified skill proficiency is unavailable until assessment
        evidence is recorded. Career pathways are suggestions to explore, never a guarantee of
        employment.
      </div>

      {state.status === 'loading' ? (
        <div className="skillography__state" role="status" aria-live="polite">
          <Spinner />
          <p>Loading your skill insights...</p>
        </div>
      ) : state.status === 'error' ? (
        <div className="state-panel state-panel--error" role="alert">
          <h3>We could not load your skill insights</h3>
          <p>{state.error.message}</p>
          <Button variant="secondary" onClick={reload}>
            Try again
          </Button>
        </div>
      ) : (
        <SkillographyContent
          skillography={state.data.skillography}
          careerPaths={state.data.careerPaths}
        />
      )}
    </section>
  )
}
