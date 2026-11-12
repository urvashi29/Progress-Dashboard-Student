import {
  CAREER_PATHWAY_LIMITATIONS,
  CAREER_PATHWAYS_METHODOLOGY,
  CAREER_PATHS,
  MODULES,
  MOCK_DASHBOARD,
  SKILLOGRAPHY_LIMITATIONS,
  SKILLOGRAPHY_METHODOLOGY,
  SKILL_CATALOG,
  TRACKS,
  getSkillById,
  getSkillPracticeAreas,
  type CareerPathListResponse,
  type CareerPathMatch,
  type CareerSkill,
  type ModuleSkillMapping,
  type SkillExposure,
  type SkillExposureModule,
  type SkillStatus,
  type SkillographyResponse,
} from '@spd/shared'
import {
  CareerPathListResponseSchema,
  SkillographyResponseSchema,
} from '@spd/shared'

const IMPORTANCE_RANK = { supporting: 1, core: 2, critical: 3 } as const

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

function statusFor(exposure: number | null, hasInPlan: boolean): SkillStatus {
  if (exposure === null) return hasInPlan ? 'UNAVAILABLE' : 'NOT_IN_PLAN'
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

function buildExposures(): SkillExposure[] {
  const modulesBySlug = new Map(
    MOCK_DASHBOARD.modules.map((module) => [module.moduleSlug, module] as const),
  )

  return SKILL_CATALOG.map((catalogSkill) => {
    const ordered = catalogSkill.moduleAssociations.slice().sort((a, b) => {
      const orderA = modulesBySlug.get(a.moduleSlug)?.catalogOrder ?? 999
      const orderB = modulesBySlug.get(b.moduleSlug)?.catalogOrder ?? 999
      return orderA - orderB
    })

    const moduleAssociations: SkillExposureModule[] = ordered.map((association) => {
      const module = modulesBySlug.get(association.moduleSlug)
      const inPlan = module?.inPlan ?? false
      const progressPct = inPlan ? (module?.progressPct ?? 0) : null
      return {
        moduleSlug: association.moduleSlug,
        moduleName: association.moduleName,
        track: association.track,
        weight: association.weight,
        importance: association.importance,
        inPlan,
        progressAvailable: inPlan,
        progressPct,
        contributionPct:
          inPlan && progressPct !== null ? round1(association.weight * progressPct) : 0,
      }
    })

    const inPlanAssociations = ordered.filter(
      (association) => modulesBySlug.get(association.moduleSlug)?.inPlan === true,
    )
    const totalWeight = inPlanAssociations.reduce(
      (total, association) => total + association.weight,
      0,
    )
    const weighted = inPlanAssociations.reduce((total, association) => {
      const module = modulesBySlug.get(association.moduleSlug)
      return total + association.weight * (module?.progressPct ?? 0)
    }, 0)
    const estimatedExposurePct = totalWeight > 0 ? round1(weighted / totalWeight) : null
    const status = statusFor(estimatedExposurePct, inPlanAssociations.length > 0)

    return {
      skillId: catalogSkill.id,
      name: catalogSkill.name,
      normalizedName: catalogSkill.normalizedName,
      description: catalogSkill.description,
      importance: catalogSkill.importance,
      estimatedExposurePct,
      status,
      confidence: 'low' as const,
      confidenceLabel:
        'Low confidence \u2014 inferred from module completion, not assessed proficiency.',
      limitation: limitationFor(status, estimatedExposurePct),
      requiresPractice:
        status === 'IN_PROGRESS' || status === 'NOT_STARTED' || status === 'UNAVAILABLE',
      moduleAssociations,
      evidenceSources: inPlanAssociations.map((association) => {
        const module = modulesBySlug.get(association.moduleSlug)
        const progressPct = module?.progressPct ?? 0
        return {
          type: 'module_progress' as const,
          moduleSlug: association.moduleSlug,
          moduleName: association.moduleName,
          progressPct,
          weight: association.weight,
          contributionPct: round1(association.weight * progressPct),
          updatedAt: module?.updatedAt ?? MOCK_DASHBOARD.enrollment.progressUpdatedAt,
        }
      }),
      prerequisiteSkillIds: catalogSkill.prerequisiteSkillIds,
      practiceActivities: catalogSkill.practiceActivities,
      portfolioEvidence: catalogSkill.portfolioEvidence,
    }
  })
}

function buildMockSkillography(): SkillographyResponse {
  const exposures = buildExposures()
  const exposuresById = new Map(exposures.map((entry) => [entry.skillId, entry]))
  const modulesBySlug = new Map(
    MOCK_DASHBOARD.modules.map((module) => [module.moduleSlug, module] as const),
  )

  const modules: ModuleSkillMapping[] = MOCK_DASHBOARD.modules.map((module) => {
    const catalogModule = MODULES.find((entry) => entry.slug === module.moduleSlug)
    return {
      moduleSlug: module.moduleSlug,
      name: module.name,
      track: module.track,
      catalogOrder: module.catalogOrder,
      inPlan: module.inPlan,
      progressPct: module.progressPct,
      band: module.band,
      skills: (catalogModule?.skills ?? []).map((skill) => ({
        skillId: skill.id,
        name: skill.name,
        weight: skill.weight,
        importance: skill.importance,
      })),
    }
  })

  const primaryTrack = new Map<string, string>()
  for (const skill of SKILL_CATALOG) {
    const primary = skill.moduleAssociations.slice().sort((a, b) => {
      if (b.weight !== a.weight) return b.weight - a.weight
      const orderA = modulesBySlug.get(a.moduleSlug)?.catalogOrder ?? 999
      const orderB = modulesBySlug.get(b.moduleSlug)?.catalogOrder ?? 999
      return orderA - orderB
    })[0]
    if (primary) primaryTrack.set(skill.id, primary.track)
  }

  const tracks = TRACKS.slice()
    .sort((a, b) => a.order - b.order)
    .map((track) => {
      const skillIds = SKILL_CATALOG.filter((skill) => primaryTrack.get(skill.id) === track.slug).map(
        (skill) => skill.id,
      )
      const trackSkills = skillIds
        .map((skillId) => exposuresById.get(skillId))
        .filter((entry): entry is SkillExposure => entry !== undefined)
      const withExposure = trackSkills.filter((entry) => entry.estimatedExposurePct !== null)
      return {
        track: track.slug,
        name: track.name,
        skillIds,
        skillCount: skillIds.length,
        inPlanSkillCount: trackSkills.filter((entry) => entry.status !== 'NOT_IN_PLAN').length,
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

  const sortedSkills = exposures.slice().sort((a, b) => {
    const importance = IMPORTANCE_RANK[b.importance] - IMPORTANCE_RANK[a.importance]
    if (importance !== 0) return importance
    return a.name.localeCompare(b.name)
  })

  return SkillographyResponseSchema.parse({
    student: MOCK_DASHBOARD.student,
    enrollment: MOCK_DASHBOARD.enrollment,
    skills: sortedSkills,
    tracks,
    modules,
    practiceAreas: getSkillPracticeAreas(exposures),
    methodology: SKILLOGRAPHY_METHODOLOGY,
    limitations: [...SKILLOGRAPHY_LIMITATIONS],
    skillsAreEstimated: true,
    proficiencyAvailable: false,
    generatedAt: MOCK_DASHBOARD.generatedAt,
  })
}

function toCareerSkill(
  exposuresById: Map<string, SkillExposure>,
  skillId: string,
  importance: 'required' | 'helpful',
): CareerSkill {
  const exposure = exposuresById.get(skillId)
  if (!exposure) {
    const skill = getSkillById(skillId)
    return {
      skillId,
      name: skill?.name ?? skillId,
      description: skill?.description ?? '',
      importance,
      estimatedExposurePct: null,
      status: 'NOT_IN_PLAN',
      supportingModuleSlugs: skill?.moduleAssociations.map((entry) => entry.moduleSlug) ?? [],
      limitation: 'This skill is not mapped to a module in the approved catalog.',
    }
  }
  return {
    skillId,
    name: exposure.name,
    description: exposure.description,
    importance,
    estimatedExposurePct: exposure.estimatedExposurePct,
    status: exposure.status,
    supportingModuleSlugs: exposure.moduleAssociations.map((entry) => entry.moduleSlug),
    limitation: exposure.limitation,
  }
}

function stageFor(coverage: number) {
  if (coverage >= 70) return { stage: 'DEVELOPING' as const, label: 'Developing pathway coverage' }
  if (coverage >= 35) return { stage: 'BUILDING' as const, label: 'Building pathway foundations' }
  return { stage: 'EXPLORING' as const, label: 'Exploring this pathway' }
}

function buildCareerPathMatch(
  definition: (typeof CAREER_PATHS)[number],
  exposuresById: Map<string, SkillExposure>,
): CareerPathMatch {
  const requiredSkills = definition.requiredSkillIds.map((skillId) =>
    toCareerSkill(exposuresById, skillId, 'required'),
  )
  const helpfulSkills = definition.helpfulSkillIds.map((skillId) =>
    toCareerSkill(exposuresById, skillId, 'helpful'),
  )
  const estimatedCoveragePct = round1(
    requiredSkills.reduce((total, skill) => total + (skill.estimatedExposurePct ?? 0), 0) /
      Math.max(1, requiredSkills.length),
  )
  const { stage, label } = stageFor(estimatedCoveragePct)
  const missingCompetencies = requiredSkills
    .filter((skill) => skill.status !== 'STRONG_EXPOSURE')
    .map((skill) => {
      const catalogSkill = getSkillById(skill.skillId)
      const reason =
        skill.status === 'NOT_IN_PLAN'
          ? 'No module in your current plan introduces this skill yet.'
          : skill.status === 'NOT_STARTED'
            ? 'The related module is in your plan but has 0% progress.'
            : skill.status === 'UNAVAILABLE'
              ? 'Progress for the related module is unavailable.'
              : `Partial exposure only (estimated ${skill.estimatedExposurePct ?? 0}%).`
      return {
        skillId: skill.skillId,
        name: skill.name,
        status: skill.status,
        reason,
        suggestedModuleSlugs:
          catalogSkill?.moduleAssociations
            .map((entry) => entry.moduleSlug)
            .filter((slug) => definition.moduleSlugs.includes(slug)) ?? [],
        practiceActivities: catalogSkill?.practiceActivities ?? [],
        portfolioEvidence: catalogSkill?.portfolioEvidence ?? [],
      }
    })

  const nextLearningActivities = missingCompetencies.slice(0, 4).flatMap((competency) => {
    const activity = competency.practiceActivities[0]
    const catalogSkill = getSkillById(competency.skillId)
    const moduleSlug = catalogSkill?.moduleAssociations[0]?.moduleSlug ?? null
    if (!activity || !moduleSlug) return []
    const module = MOCK_DASHBOARD.modules.find((entry) => entry.moduleSlug === moduleSlug)
    return [
      {
        skillId: competency.skillId,
        skillName: competency.name,
        moduleSlug,
        moduleName: module?.name ?? catalogSkill?.moduleAssociations[0]?.moduleName ?? null,
        title: activity.title,
        type: activity.type,
        minutes: activity.minutes,
      },
    ]
  })

  const strongCount = requiredSkills.filter((skill) => skill.status === 'STRONG_EXPOSURE').length

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
    nextLearningActivities,
    explanation: [
      `${strongCount} of ${requiredSkills.length} required skills have strong estimated exposure from module progress.`,
      `Estimated curriculum coverage is ${estimatedCoveragePct}% across the required skills for this pathway.`,
      `${missingCompetencies.length} required skill${missingCompetencies.length === 1 ? '' : 's'} need further learning or evidence.`,
      'This is pathway exploration guidance, not a statement that you are job-ready or qualified for a role.',
    ],
    limitations: [...CAREER_PATHWAY_LIMITATIONS],
    pathwayNote: definition.pathwayNote,
    employmentClaim: false,
  }
}

function buildMockCareerPaths(): CareerPathListResponse {
  const exposuresById = new Map(buildExposures().map((entry) => [entry.skillId, entry]))
  return CareerPathListResponseSchema.parse({
    careerPaths: CAREER_PATHS.map((definition) =>
      buildCareerPathMatch(definition, exposuresById),
    ),
    methodology: CAREER_PATHWAYS_METHODOLOGY,
    limitations: [...CAREER_PATHWAY_LIMITATIONS],
    generatedAt: MOCK_DASHBOARD.generatedAt,
  })
}

export const MOCK_SKILLOGRAPHY = buildMockSkillography()
export const MOCK_CAREER_PATHS = buildMockCareerPaths()
