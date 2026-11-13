import {
  MODULES,
  getModuleBySlug,
  type CatalogModule,
  type CoachRecommendation,
  type CoachRecommendationAction,
  type CoachSkillReference,
  type Enrollment,
  type ModuleProgressRecord,
  type RecommendationType,
  type TrackSlug,
} from '@spd/shared'

export interface RecommendationEngineInput {
  enrollment: Enrollment
  moduleProgress: readonly ModuleProgressRecord[]
}

interface ModuleState {
  catalog: CatalogModule
  progressPct: number
  inPlan: boolean
}

interface Candidate {
  catalog: CatalogModule
  type: RecommendationType
  score: number
  progressPct: number
  inPlan: boolean
  reason: string
}

const MAX_RECOMMENDATIONS = 3

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value))
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

function buildStates(moduleProgress: readonly ModuleProgressRecord[]): Map<string, ModuleState> {
  const bySlug = new Map(moduleProgress.map((record) => [record.moduleSlug, record] as const))
  const states = new Map<string, ModuleState>()

  for (const catalog of MODULES) {
    const record = bySlug.get(catalog.slug)
    states.set(catalog.slug, {
      catalog,
      progressPct: record && Number.isFinite(record.progressPct)
        ? clampPercent(record.progressPct)
        : 0,
      inPlan: record?.inPlan ?? false,
    })
  }

  return states
}

function isComplete(state: ModuleState): boolean {
  return state.inPlan && state.progressPct >= 100
}

function isStarted(state: ModuleState): boolean {
  return state.inPlan && state.progressPct > 0 && state.progressPct < 100
}

function prerequisitesComplete(
  module: CatalogModule,
  states: ReadonlyMap<string, ModuleState>,
): boolean {
  return module.prerequisiteModuleSlugs.every((slug) => {
    const prerequisite = states.get(slug)
    return prerequisite ? isComplete(prerequisite) : false
  })
}

function skillsFor(module: CatalogModule): CoachSkillReference[] {
  return module.skills
    .slice()
    .sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name))
    .slice(0, 4)
    .map((skill) => ({
      id: skill.id,
      name: skill.name,
      importance: skill.importance,
    }))
}

function actionFor(state: ModuleState): CoachRecommendationAction {
  return state.inPlan && state.progressPct > 0 ? 'CONTINUE_MODULE' : 'VIEW_MODULE'
}

function titleFor(type: RecommendationType, module: CatalogModule): string {
  switch (type) {
    case 'NEAR_FINISH':
      return `Finish ${module.name}`
    case 'COMPLETE_PREREQUISITE':
      return `Complete prerequisite: ${module.name}`
    case 'START_MODULE':
      return `Start ${module.name}`
    case 'EXPLORE_NEXT':
      return `Explore ${module.name}`
    case 'CONTINUE_MODULE':
    default:
      return `Continue ${module.name}`
  }
}

function fallbackExplanation(type: RecommendationType, module: CatalogModule, reason: string): string {
  const skillNames = skillsFor(module).map((skill) => skill.name)
  const skillSentence =
    skillNames.length > 0
      ? ` It is mapped to ${skillNames.join(', ')} in the curriculum.`
      : ''
  const nextStep =
    type === 'NEAR_FINISH'
      ? ' Finishing the remaining module content is the most direct next step.'
      : type === 'COMPLETE_PREREQUISITE'
        ? ' Completing it removes a prerequisite block for later modules in your plan.'
        : type === 'EXPLORE_NEXT'
          ? ' It is an existing catalog module and is not currently part of your plan.'
          : ' Continue the remaining module content next.'

  return `${reason}${nextStep}${skillSentence}`
}

function pushCandidate(
  candidates: Candidate[],
  state: ModuleState,
  type: RecommendationType,
  score: number,
  reason: string,
): void {
  candidates.push({
    catalog: state.catalog,
    type,
    score,
    progressPct: round1(state.progressPct),
    inPlan: state.inPlan,
    reason,
  })
}

/**
 * Deterministic, progress-only recommendation selection. Gemini never chooses
 * or changes these modules; it only writes explanatory prose for the chosen
 * candidates.
 */
export function buildRecommendationCandidates(
  input: RecommendationEngineInput,
): Candidate[] {
  const states = buildStates(input.moduleProgress)
  const inPlan = [...states.values()].filter((state) => state.inPlan)
  const candidates: Candidate[] = []

  // Prioritize modules that are almost complete.
  for (const state of inPlan) {
    if (state.progressPct >= 80 && state.progressPct < 100) {
      pushCandidate(
        candidates,
        state,
        'NEAR_FINISH',
        2000 + state.progressPct,
        `This module is ${round1(state.progressPct)}% complete, so finishing the remaining content is the fastest route to completing it.`,
      )
    }
  }

  // Recommend incomplete prerequisites that block other in-plan modules.
  const blockingPrerequisites = new Map<string, { dependentCount: number; maxDependentProgress: number }>()
  for (const dependent of inPlan) {
    if (dependent.progressPct >= 100) continue
    for (const prereqSlug of dependent.catalog.prerequisiteModuleSlugs) {
      const prerequisite = states.get(prereqSlug)
      if (!prerequisite || prerequisite.progressPct >= 100) continue
      const existing = blockingPrerequisites.get(prereqSlug) ?? {
        dependentCount: 0,
        maxDependentProgress: 0,
      }
      existing.dependentCount += 1
      existing.maxDependentProgress = Math.max(
        existing.maxDependentProgress,
        dependent.progressPct,
      )
      blockingPrerequisites.set(prereqSlug, existing)
    }
  }

  for (const [slug, blocking] of [...blockingPrerequisites.entries()].sort(
    ([a], [b]) => a.localeCompare(b),
  )) {
    const prerequisite = states.get(slug)
    if (!prerequisite) continue
    // Only surface an actionable prerequisite: one that is already started or
    // whose own prerequisites are satisfied. Recommending a fully blocked
    // zero-progress module would not help the student move forward.
    if (
      prerequisite.progressPct === 0 &&
      !prerequisitesComplete(prerequisite.catalog, states)
    ) {
      continue
    }
    const eligibilityBonus = prerequisitesComplete(prerequisite.catalog, states) ? 100 : 0
    const scope =
      blocking.dependentCount === 1
        ? 'a later module in your plan'
        : `${blocking.dependentCount} later modules in your plan`
    pushCandidate(
      candidates,
      prerequisite,
      'COMPLETE_PREREQUISITE',
      1000 +
        eligibilityBonus +
        blocking.dependentCount * 20 +
        blocking.maxDependentProgress,
      prerequisite.inPlan
        ? `This module is ${round1(prerequisite.progressPct)}% complete and is a prerequisite for ${scope}.`
        : `This module is not in your current plan, but it is a prerequisite for ${scope}.`,
    )
  }

  // Continue partially completed modules.
  for (const state of inPlan) {
    if (!isStarted(state)) continue
    pushCandidate(
      candidates,
      state,
      'CONTINUE_MODULE',
      700 + state.progressPct,
      state.progressPct >= 80
        ? `This module is ${round1(state.progressPct)}% complete and is close to finished.`
        : `This module is ${round1(state.progressPct)}% complete and is part of your current plan.`,
    )
  }

  // Start an in-plan module whose prerequisites are already complete.
  for (const state of inPlan) {
    if (state.progressPct !== 0) continue
    if (!prerequisitesComplete(state.catalog, states)) continue
    pushCandidate(
      candidates,
      state,
      'START_MODULE',
      500 - state.catalog.catalogOrder,
      'This module is in your plan, has no incomplete prerequisite, and has not been started yet.',
    )
  }

  // Explore the next relevant existing module outside the current plan.
  const highestInPlanOrder = inPlan.reduce(
    (max, state) => Math.max(max, state.catalog.catalogOrder),
    0,
  )
  const explorable = MODULES.filter((module) => {
    const state = states.get(module.slug)
    return state && !state.inPlan && prerequisitesComplete(module, states)
  }).sort((a, b) => a.catalogOrder - b.catalogOrder)

  const nextExplorable =
    explorable.find((module) => module.catalogOrder > highestInPlanOrder) ?? explorable[0]
  if (nextExplorable) {
    const state = states.get(nextExplorable.slug)
    if (state) {
      pushCandidate(
        candidates,
        state,
        'EXPLORE_NEXT',
        300 - nextExplorable.catalogOrder,
        'This existing catalog module is not in your current plan and has no incomplete listed prerequisite.',
      )
    }
  }

  return candidates
}

function dedupeCandidates(candidates: Candidate[]): Candidate[] {
  const bestBySlug = new Map<string, Candidate>()
  for (const candidate of candidates) {
    const existing = bestBySlug.get(candidate.catalog.slug)
    if (!existing || candidate.score > existing.score) {
      bestBySlug.set(candidate.catalog.slug, candidate)
    }
  }
  return [...bestBySlug.values()].sort(
    (a, b) =>
      b.score - a.score ||
      a.catalog.catalogOrder - b.catalog.catalogOrder ||
      a.catalog.slug.localeCompare(b.catalog.slug),
  )
}

export function buildDeterministicRecommendations(
  input: RecommendationEngineInput,
): CoachRecommendation[] {
  return dedupeCandidates(buildRecommendationCandidates(input))
    .slice(0, MAX_RECOMMENDATIONS)
    .map((candidate, index) => ({
      id: `rec-${candidate.catalog.slug}-${candidate.type.toLowerCase()}`,
      type: candidate.type,
      moduleSlug: candidate.catalog.slug,
      moduleName: candidate.catalog.name,
      track: candidate.catalog.track as TrackSlug,
      title: titleFor(candidate.type, candidate.catalog),
      reason: candidate.reason,
      explanation: fallbackExplanation(candidate.type, candidate.catalog, candidate.reason),
      priority: index + 1,
      progressPct: candidate.progressPct,
      inPlan: candidate.inPlan,
      action: actionFor({
        catalog: candidate.catalog,
        inPlan: candidate.inPlan,
        progressPct: candidate.progressPct,
      }),
      skills: skillsFor(candidate.catalog),
      estimatedMinutes: null,
      expectedGainPct: null,
    }))
}

export function buildFallbackHeadline(recommendations: readonly CoachRecommendation[]): string {
  const first = recommendations[0]
  if (!first) {
    return 'No module recommendations are available for your current progress.'
  }
  if (first.type === 'NEAR_FINISH') {
    return `Finish ${first.moduleName} next.`
  }
  if (first.type === 'COMPLETE_PREREQUISITE') {
    return `Complete ${first.moduleName} to unblock later modules.`
  }
  if (first.type === 'START_MODULE') {
    return `Start ${first.moduleName} next.`
  }
  if (first.type === 'EXPLORE_NEXT') {
    return `Explore ${first.moduleName} next.`
  }
  return `Continue ${first.moduleName} next.`
}

export function findModuleState(
  moduleProgress: readonly ModuleProgressRecord[],
  slug: string,
): { catalog: CatalogModule; progressPct: number; inPlan: boolean } | null {
  const catalog = getModuleBySlug(slug)
  if (!catalog) return null
  const record = moduleProgress.find((entry) => entry.moduleSlug === slug)
  return {
    catalog,
    progressPct: record && Number.isFinite(record.progressPct)
      ? round1(clampPercent(record.progressPct))
      : 0,
    inPlan: record?.inPlan ?? false,
  }
}
