import {
  CAREER_PATHWAY_LIMITATIONS,
  CAREER_PATHWAYS_METHODOLOGY,
  CAREER_PATHS,
  MODULES,
  SKILLOGRAPHY_LIMITATIONS,
  SKILLOGRAPHY_METHODOLOGY,
  SKILL_CATALOG,
  TRACKS,
  getCareerPath,
  getSkillById,
  getSkillPracticeAreas,
  moduleProgressBand,
  type CareerPathDefinition,
  type CareerPathDetailResponse,
  type CareerPathListResponse,
  type CareerPathMatch,
  type CareerSkill,
  type Enrollment,
  type MissingCompetency,
  type ModuleProgressRecord,
  type ModuleSkillMapping,
  type NextLearningActivity,
  type SkillEvidenceSource,
  type SkillExposure,
  type SkillExposureModule,
  type SkillListResponse,
  type SkillographyResponse,
  type SkillographyTrack,
  type SkillStatus,
  type StudentProfile,
} from '@spd/shared'
import {
  CareerPathDetailResponseSchema,
  CareerPathListResponseSchema,
  SkillListResponseSchema,
  SkillographyResponseSchema,
} from '@spd/shared'
import { buildDashboardModules } from './dashboard'

export interface SkillographyInput {
  student: StudentProfile
  enrollment: Enrollment
  moduleProgress: readonly ModuleProgressRecord[]
  now: Date
  timeZone?: string
}

const IMPORTANCE_RANK = { supporting: 1, core: 2, critical: 3 } as const

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value))
}

function statusFor(
  exposure: number | null,
  hasInPlanAssociation: boolean,
): SkillStatus {
  if (exposure === null) {
    return hasInPlanAssociation ? 'UNAVAILABLE' : 'NOT_IN_PLAN'
  }
  if (exposure >= 80) return 'STRONG_EXPOSURE'
  if (exposure > 0) return 'IN_PROGRESS'
  return 'NOT_STARTED'
}

function limitationFor(status: SkillStatus, exposure: number | null): string {
  switch (status) {
    case 'NOT_IN_PLAN':
      return 'None of this skill\u2019s modules are in your current plan, so no exposure is estimated.'
    case 'UNAVAILABLE':
      return 'Progress for a supporting module is unavailable, so exposure cannot be estimated yet.'
    case 'NOT_STARTED':
      return 'The supporting module is in your plan but shows 0% progress.'
    case 'IN_PROGRESS':
      return `Estimated ${exposure ?? 0}% exposure from partial module progress. No assessment evidence is available.`
    case 'STRONG_EXPOSURE':
      return `Estimated ${exposure ?? 0}% exposure from module progress. Module completion does not confirm proficiency.`
  }
}

interface ComputedState {
  modules: ModuleSkillMapping[]
  exposures: SkillExposure[]
  tracks: SkillographyTrack[]
}

/**
 * Deterministic, explainable exposure engine.
 *
 * For every catalog skill, only the student's in-plan module associations are
 * counted. The estimate is the progress-weighted mean of those modules:
 *
 *   exposure = 100 * Σ(weight_i × progress_i / 100) / Σ(weight_i)
 *
 * Associations outside the plan are excluded rather than treated as 0%.
 * A skill with no in-plan association returns null exposure, preserving the
 * distinction between "not in plan" and a real 0% module.
 */
export function computeSkillState(input: SkillographyInput): ComputedState {
  const dashboardModules = buildDashboardModules(input)
  const moduleBySlug = new Map(dashboardModules.map((entry) => [entry.moduleSlug, entry]))
  const rawProgressBySlug = new Map(
    input.moduleProgress.map((record) => [record.moduleSlug, record] as const),
  )

  const exposures = SKILL_CATALOG.map((catalogSkill): SkillExposure => {
    const orderedAssociations = catalogSkill.moduleAssociations.slice().sort((a, b) => {
      const orderA = moduleBySlug.get(a.moduleSlug)?.catalogOrder ?? 999
      const orderB = moduleBySlug.get(b.moduleSlug)?.catalogOrder ?? 999
      return orderA - orderB
    })

    const moduleAssociations: SkillExposureModule[] = orderedAssociations.map((association) => {
      const module = moduleBySlug.get(association.moduleSlug)
      const raw = rawProgressBySlug.get(association.moduleSlug)
      const inPlan = module?.inPlan ?? false
      const progressAvailable = inPlan && raw !== undefined && Number.isFinite(raw.progressPct)
      const progressPct = progressAvailable
        ? clampPercent(raw?.progressPct ?? 0)
        : null
      return {
        moduleSlug: association.moduleSlug,
        moduleName: association.moduleName,
        track: association.track,
        weight: association.weight,
        importance: association.importance,
        inPlan,
        progressAvailable,
        progressPct,
        contributionPct:
          progressAvailable && progressPct !== null
            ? round1(association.weight * progressPct)
            : 0,
      }
    })

    const inPlanAssociations = orderedAssociations.filter(
      (association) => moduleBySlug.get(association.moduleSlug)?.inPlan === true,
    )
    const usableAssociations = orderedAssociations.filter((association) => {
      const raw = rawProgressBySlug.get(association.moduleSlug)
      return (
        moduleBySlug.get(association.moduleSlug)?.inPlan === true &&
        raw !== undefined &&
        Number.isFinite(raw.progressPct)
      )
    })

    const evidenceSources: SkillEvidenceSource[] = usableAssociations.map((association) => {
      const module = moduleBySlug.get(association.moduleSlug)
      const raw = rawProgressBySlug.get(association.moduleSlug)
      const progressPct = clampPercent(raw?.progressPct ?? 0)
      return {
        type: 'module_progress',
        moduleSlug: association.moduleSlug,
        moduleName: association.moduleName,
        progressPct,
        weight: association.weight,
        contributionPct: round1(association.weight * progressPct),
        updatedAt: module?.updatedAt ?? input.enrollment.progressUpdatedAt,
      }
    })

    const totalWeight = usableAssociations.reduce(
      (total, association) => total + association.weight,
      0,
    )
    const weightedProgress = usableAssociations.reduce((total, association) => {
      const raw = rawProgressBySlug.get(association.moduleSlug)
      return total + association.weight * clampPercent(raw?.progressPct ?? 0)
    }, 0)

    const estimatedExposurePct =
      totalWeight > 0 ? round1(weightedProgress / totalWeight) : null
    const status = statusFor(estimatedExposurePct, inPlanAssociations.length > 0)

    return {
      skillId: catalogSkill.id,
      name: catalogSkill.name,
      normalizedName: catalogSkill.normalizedName,
      description: catalogSkill.description,
      importance: catalogSkill.importance,
      estimatedExposurePct,
      status,
      confidence: 'low',
      confidenceLabel:
        'Low confidence \u2014 inferred from module completion, not assessed proficiency.',
      limitation: limitationFor(status, estimatedExposurePct),
      requiresPractice:
        status === 'IN_PROGRESS' || status === 'NOT_STARTED' || status === 'UNAVAILABLE',
      moduleAssociations,
      evidenceSources,
      prerequisiteSkillIds: catalogSkill.prerequisiteSkillIds,
      practiceActivities: catalogSkill.practiceActivities,
      portfolioEvidence: catalogSkill.portfolioEvidence,
    }
  })

  const exposuresById = new Map(exposures.map((entry) => [entry.skillId, entry]))

  const modules: ModuleSkillMapping[] = dashboardModules.map((module) => {
    const catalogModule = MODULES.find((entry) => entry.slug === module.moduleSlug)
    return {
      moduleSlug: module.moduleSlug,
      name: module.name,
      track: module.track,
      catalogOrder: module.catalogOrder,
      inPlan: module.inPlan,
      progressPct: module.progressPct,
      band: moduleProgressBand(module.progressPct, module.inPlan),
      skills: (catalogModule?.skills ?? []).map((skill) => ({
        skillId: skill.id,
        name: skill.name,
        weight: skill.weight,
        importance: skill.importance,
      })),
    }
  })

  const primaryTrackBySkill = new Map<string, string>()
  for (const catalogSkill of SKILL_CATALOG) {
    const primary = catalogSkill.moduleAssociations.slice().sort((a, b) => {
      if (b.weight !== a.weight) return b.weight - a.weight
      const orderA = moduleBySlug.get(a.moduleSlug)?.catalogOrder ?? 999
      const orderB = moduleBySlug.get(b.moduleSlug)?.catalogOrder ?? 999
      return orderA - orderB
    })[0]
    if (primary) primaryTrackBySkill.set(catalogSkill.id, primary.track)
  }

  const tracks: SkillographyTrack[] = TRACKS.slice()
    .sort((a, b) => a.order - b.order)
    .map((track) => {
      const skillIds = SKILL_CATALOG.filter(
        (entry) => primaryTrackBySkill.get(entry.id) === track.slug,
      ).map((entry) => entry.id)
      const skillExposures = skillIds
        .map((skillId) => exposuresById.get(skillId))
        .filter((entry): entry is SkillExposure => entry !== undefined)
      const withExposure = skillExposures.filter(
        (entry) => entry.estimatedExposurePct !== null,
      )
      return {
        track: track.slug,
        name: track.name,
        skillIds,
        skillCount: skillIds.length,
        inPlanSkillCount: skillExposures.filter((entry) => entry.status !== 'NOT_IN_PLAN')
          .length,
        averageExposurePct:
          withExposure.length === 0
            ? null
            : round1(
                withExposure.reduce(
                  (total, entry) => total + (entry.estimatedExposurePct ?? 0),
                  0,
                ) / withExposure.length,
              ),
      }
    })

  return { modules, exposures, tracks }
}

function sortedExposures(exposures: readonly SkillExposure[]): SkillExposure[] {
  return exposures
    .slice()
    .sort((a, b) => {
      const importance = IMPORTANCE_RANK[b.importance] - IMPORTANCE_RANK[a.importance]
      if (importance !== 0) return importance
      return a.name.localeCompare(b.name)
    })
}

export function buildSkillList(input: SkillographyInput): SkillListResponse {
  const state = computeSkillState(input)
  return SkillListResponseSchema.parse({
    skills: sortedExposures(state.exposures),
    practiceAreas: getSkillPracticeAreas(state.exposures),
    methodology: SKILLOGRAPHY_METHODOLOGY,
    limitations: [...SKILLOGRAPHY_LIMITATIONS],
    skillsAreEstimated: true,
    proficiencyAvailable: false,
    generatedAt: input.now.toISOString(),
  })
}

export function buildSkillography(input: SkillographyInput): SkillographyResponse {
  const state = computeSkillState(input)
  return SkillographyResponseSchema.parse({
    student: input.student,
    enrollment: input.enrollment,
    skills: sortedExposures(state.exposures),
    tracks: state.tracks,
    modules: state.modules,
    practiceAreas: getSkillPracticeAreas(state.exposures),
    methodology: SKILLOGRAPHY_METHODOLOGY,
    limitations: [...SKILLOGRAPHY_LIMITATIONS],
    skillsAreEstimated: true,
    proficiencyAvailable: false,
    generatedAt: input.now.toISOString(),
  })
}

function toCareerSkill(
  exposure: SkillExposure | undefined,
  skillId: string,
  importance: 'required' | 'helpful',
): CareerSkill {
  if (!exposure) {
    const catalogSkill = getSkillById(skillId)
    return {
      skillId,
      name: catalogSkill?.name ?? skillId,
      description: catalogSkill?.description ?? '',
      importance,
      estimatedExposurePct: null,
      status: 'NOT_IN_PLAN',
      supportingModuleSlugs: catalogSkill?.moduleAssociations.map((entry) => entry.moduleSlug) ?? [],
      limitation: 'This skill is not mapped to a module in the approved catalog.',
    }
  }
  return {
    skillId: exposure.skillId,
    name: exposure.name,
    description: exposure.description,
    importance,
    estimatedExposurePct: exposure.estimatedExposurePct,
    status: exposure.status,
    supportingModuleSlugs: exposure.moduleAssociations.map((entry) => entry.moduleSlug),
    limitation: exposure.limitation,
  }
}

function missingReason(skill: CareerSkill): string {
  switch (skill.status) {
    case 'NOT_IN_PLAN':
      return 'No module in your current plan introduces this skill yet.'
    case 'NOT_STARTED':
      return 'The related module is in your plan but has 0% progress.'
    case 'UNAVAILABLE':
      return 'Progress for the related module is unavailable, so this gap cannot be confirmed.'
    case 'IN_PROGRESS':
      return `Partial exposure only (estimated ${skill.estimatedExposurePct ?? 0}%). More practice and evidence are needed.`
    case 'STRONG_EXPOSURE':
      return 'Strong estimated exposure; portfolio evidence is still needed to demonstrate it.'
  }
}

function toMissingCompetency(
  skill: CareerSkill,
  definition: CareerPathDefinition,
): MissingCompetency {
  const catalogSkill = getSkillById(skill.skillId)
  const suggestedModuleSlugs = catalogSkill
    ? catalogSkill.moduleAssociations
        .map((entry) => entry.moduleSlug)
        .filter((slug) => definition.moduleSlugs.includes(slug))
    : []
  return {
    skillId: skill.skillId,
    name: skill.name,
    status: skill.status,
    reason: missingReason(skill),
    suggestedModuleSlugs,
    practiceActivities: catalogSkill?.practiceActivities ?? [],
    portfolioEvidence: catalogSkill?.portfolioEvidence ?? [],
  }
}

function nextActivitiesFor(
  missing: readonly MissingCompetency[],
  modulesBySlug: Map<string, { name: string }>,
): NextLearningActivity[] {
  const activities: NextLearningActivity[] = []
  const seen = new Set<string>()

  for (const competency of missing) {
    const catalogSkill = getSkillById(competency.skillId)
    if (!catalogSkill) continue
    const moduleSlug = catalogSkill.moduleAssociations[0]?.moduleSlug ?? null
    const moduleName = moduleSlug
      ? (modulesBySlug.get(moduleSlug)?.name ?? catalogSkill.moduleAssociations[0]?.moduleName)
      : null
    for (const activity of competency.practiceActivities) {
      const key = `${competency.skillId}:${activity.type}:${activity.title}`
      if (seen.has(key)) continue
      seen.add(key)
      activities.push({
        skillId: competency.skillId,
        skillName: competency.name,
        moduleSlug,
        moduleName: moduleName ?? null,
        title: activity.title,
        type: activity.type,
        minutes: activity.minutes,
      })
      break
    }
    if (activities.length >= 6) break
  }

  return activities
}

function stageFor(coverage: number): { stage: 'EXPLORING' | 'BUILDING' | 'DEVELOPING'; label: string } {
  if (coverage >= 70) {
    return { stage: 'DEVELOPING', label: 'Developing pathway coverage' }
  }
  if (coverage >= 35) {
    return { stage: 'BUILDING', label: 'Building pathway foundations' }
  }
  return { stage: 'EXPLORING', label: 'Exploring this pathway' }
}

function buildCareerPathMatch(
  definition: CareerPathDefinition,
  exposuresById: Map<string, SkillExposure>,
  modulesBySlug: Map<string, { name: string }>,
): CareerPathMatch {
  const requiredSkills = definition.requiredSkillIds.map((skillId) =>
    toCareerSkill(exposuresById.get(skillId), skillId, 'required'),
  )
  const helpfulSkills = definition.helpfulSkillIds.map((skillId) =>
    toCareerSkill(exposuresById.get(skillId), skillId, 'helpful'),
  )

  const estimatedCoveragePct = round1(
    requiredSkills.reduce(
      (total, skill) => total + (skill.estimatedExposurePct ?? 0),
      0,
    ) / Math.max(1, requiredSkills.length),
  )
  const { stage, label } = stageFor(estimatedCoveragePct)

  const strongCount = requiredSkills.filter(
    (skill) => skill.status === 'STRONG_EXPOSURE',
  ).length
  const missingCompetencies = requiredSkills
    .filter((skill) => skill.status !== 'STRONG_EXPOSURE')
    .map((skill) => toMissingCompetency(skill, definition))

  const explanation = [
    `${strongCount} of ${requiredSkills.length} required skills have strong estimated exposure from module progress.`,
    `Estimated curriculum coverage is ${estimatedCoveragePct}% across the required skills for this pathway.`,
    missingCompetencies.length === 0
      ? 'All required skills have strong estimated exposure, but portfolio and assessment evidence are still not recorded.'
      : `${missingCompetencies.length} required skill${missingCompetencies.length === 1 ? '' : 's'} need further learning or evidence.`,
    'This is pathway exploration guidance, not a statement that you are job-ready or qualified for a role.',
  ]

  return {
    slug: definition.slug,
    title: definition.title,
    description: definition.description,
    estimatedCoveragePct,
    stage,
    stageLabel: label,
    requiredSkills,
    helpfulSkills,
    moduleSlugs: definition.moduleSlugs,
    missingCompetencies,
    suggestedProjects: definition.suggestedProjects,
    portfolioEvidence: definition.portfolioEvidence,
    nextLearningActivities: nextActivitiesFor(missingCompetencies, modulesBySlug),
    explanation,
    limitations: [...CAREER_PATHWAY_LIMITATIONS],
    pathwayNote: definition.pathwayNote,
    employmentClaim: false,
  }
}

export function buildCareerPathMatches(input: SkillographyInput): CareerPathListResponse {
  const state = computeSkillState(input)
  const exposuresById = new Map(state.exposures.map((entry) => [entry.skillId, entry]))
  const modulesBySlug = new Map(state.modules.map((entry) => [entry.moduleSlug, entry]))

  return CareerPathListResponseSchema.parse({
    careerPaths: CAREER_PATHS.map((definition) =>
      buildCareerPathMatch(definition, exposuresById, modulesBySlug),
    ),
    methodology: CAREER_PATHWAYS_METHODOLOGY,
    limitations: [...CAREER_PATHWAY_LIMITATIONS],
    generatedAt: input.now.toISOString(),
  })
}

export function buildCareerPathDetail(
  input: SkillographyInput,
  slug: string,
): CareerPathDetailResponse | null {
  const definition = getCareerPath(slug)
  if (!definition) return null

  const state = computeSkillState(input)
  const exposuresById = new Map(state.exposures.map((entry) => [entry.skillId, entry]))
  const modulesBySlug = new Map(state.modules.map((entry) => [entry.moduleSlug, entry]))

  return CareerPathDetailResponseSchema.parse({
    careerPath: buildCareerPathMatch(definition, exposuresById, modulesBySlug),
    methodology: CAREER_PATHWAYS_METHODOLOGY,
    limitations: [...CAREER_PATHWAY_LIMITATIONS],
    generatedAt: input.now.toISOString(),
  })
}

export type { CareerPathDefinition }
