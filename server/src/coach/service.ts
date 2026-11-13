import {
  CoachAskResponseSchema,
  CoachModuleGuideSchema,
  CoachSummarySchema,
  type CoachAskResponse,
  type CoachAssessmentAvailability,
  type CoachModuleGuide,
  type CoachRecommendation,
  type CoachSummary,
  type Enrollment,
  type ModuleProgressRecord,
} from '@spd/shared'
import type { AssessmentDataAdapter } from './assessment-adapter'
import { COACH_DISCLAIMER, type CoachLlm } from './gemini'
import {
  buildDeterministicRecommendations,
  buildFallbackHeadline,
  findModuleState,
} from './recommendations'

export interface CoachServiceInput {
  enrollment: Enrollment
  moduleProgress: readonly ModuleProgressRecord[]
  now: Date
}

export interface CoachServiceDependencies {
  llm: CoachLlm | null
  assessmentData: AssessmentDataAdapter
}

function fallbackHeadline(recommendations: readonly CoachRecommendation[]): string {
  return buildFallbackHeadline(recommendations)
}

function fallbackGuidance(
  moduleName: string,
  skills: readonly string[],
  progressPct: number,
): string[] {
  const skillText =
    skills.length > 0
      ? `Review the module concepts and practice the associated skills: ${skills.join(', ')}.`
      : 'Review the module concepts and practice the associated skills.'

  return [
    progressPct >= 100
      ? `${moduleName} is marked 100% complete. Revisit its key concepts if you need a refresher.`
      : `Continue the remaining module content in ${moduleName} until it is complete.`,
    skillText,
    "Use the module's existing quizzes for revision; individual quiz status is not available in this dashboard.",
    "If the module includes coding questions, complete the existing ones; individual coding-question status is not available.",
    "Attempt the platform's assessments according to their published eligibility requirements; individual assessment status is not available.",
  ]
}

function logFallback(scope: string, error: unknown): void {
  const reason =
    error instanceof Error && 'reason' in error
      ? String((error as { reason?: unknown }).reason)
      : 'unexpected_error'
  // Never log prompts, responses, student data or credentials.
  console.warn(`[coach] ${scope} fallback: ${reason}`)
}

export async function buildCoachSummary(
  input: CoachServiceInput,
  dependencies: CoachServiceDependencies,
): Promise<CoachSummary> {
  const recommendations = buildDeterministicRecommendations(input)
  const assessmentData = await dependencies.assessmentData.getAssessmentAvailability()

  let headline = fallbackHeadline(recommendations)
  let explainedRecommendations = recommendations
  let generatedBy: 'gemini' | 'fallback' = 'fallback'

  if (dependencies.llm && recommendations.length > 0) {
    try {
      const explanation = await dependencies.llm.explainRecommendations({
        recommendations,
        assessmentData,
      })
      explainedRecommendations = recommendations.map((recommendation) => ({
        ...recommendation,
        explanation:
          explanation.explanations.get(recommendation.moduleSlug) ?? recommendation.explanation,
      }))
      headline = explanation.headline
      generatedBy = 'gemini'
    } catch (error) {
      logFallback('summary', error)
    }
  }

  return CoachSummarySchema.parse({
    headline,
    recommendations: explainedRecommendations,
    generatedBy,
    assessmentData,
    disclaimer: COACH_DISCLAIMER,
    generatedAt: input.now.toISOString(),
  })
}

export async function buildCoachModuleGuide(
  input: CoachServiceInput & { moduleSlug: string },
  dependencies: CoachServiceDependencies,
): Promise<CoachModuleGuide | null> {
  const state = findModuleState(input.moduleProgress, input.moduleSlug)
  if (!state) return null

  const assessmentData = await dependencies.assessmentData.getAssessmentAvailability()
  const skills = state.catalog.skills.map((skill) => skill.name)
  let guidance = fallbackGuidance(state.catalog.name, skills, state.progressPct)
  let generatedBy: 'gemini' | 'fallback' = 'fallback'

  if (dependencies.llm) {
    try {
      const generated = await dependencies.llm.guideModule({
        moduleSlug: state.catalog.slug,
        moduleName: state.catalog.name,
        progressPct: state.progressPct,
        inPlan: state.inPlan,
        skills,
        assessmentData,
      })
      if (generated.length >= 3) {
        guidance = generated
        generatedBy = 'gemini'
      }
    } catch (error) {
      logFallback('module-guide', error)
    }
  }

  return CoachModuleGuideSchema.parse({
    moduleSlug: state.catalog.slug,
    moduleName: state.catalog.name,
    progressPct: state.progressPct,
    inPlan: state.inPlan,
    guidance,
    generatedBy,
    assessmentData,
    disclaimer: COACH_DISCLAIMER,
    generatedAt: input.now.toISOString(),
  })
}

function fallbackAnswer(
  recommendations: readonly CoachRecommendation[],
  assessmentData: CoachAssessmentAvailability,
): string {
  const first = recommendations[0]
  const action = first
    ? `Based on your actual module progress, the strongest next step is ${first.title.toLowerCase()}. ${first.reason}`
    : 'There are no incomplete module recommendations for your current plan.'
  return `${action} ${assessmentData.note}`
}

export async function buildCoachAnswer(
  input: CoachServiceInput & { question: string; moduleSlug?: string },
  dependencies: CoachServiceDependencies,
): Promise<CoachAskResponse> {
  const recommendations = buildDeterministicRecommendations(input)
  const assessmentData = await dependencies.assessmentData.getAssessmentAvailability()
  const contextModuleSlugs = recommendations.map((entry) => entry.moduleSlug)
  let answer = fallbackAnswer(recommendations, assessmentData)
  let generatedBy: 'gemini' | 'fallback' = 'fallback'

  if (dependencies.llm) {
    try {
      answer = await dependencies.llm.answerQuestion({
        question: input.question,
        focusModuleSlug: input.moduleSlug,
        recommendations,
        assessmentData,
      })
      generatedBy = 'gemini'
    } catch (error) {
      logFallback('ask', error)
    }
  }

  return CoachAskResponseSchema.parse({
    answer,
    generatedBy,
    contextModuleSlugs,
    assessmentData,
    disclaimer: COACH_DISCLAIMER,
    generatedAt: input.now.toISOString(),
  })
}
