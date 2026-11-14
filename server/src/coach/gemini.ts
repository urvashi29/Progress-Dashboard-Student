import { GoogleGenAI } from '@google/genai'
import { z } from 'zod'
import type {
  CoachAssessmentAvailability,
  CoachRecommendation,
} from '@spd/shared'
import { COACH_DISCLAIMER } from './constants'

export { COACH_DISCLAIMER }

export type CoachLlmFailure =
  | 'not_configured'
  | 'timeout'
  | 'rate_limit'
  | 'model_unavailable'
  | 'invalid_output'
  | 'api_error'

export class CoachLlmError extends Error {
  readonly reason: CoachLlmFailure

  constructor(reason: CoachLlmFailure, message: string) {
    super(message)
    this.name = 'CoachLlmError'
    this.reason = reason
  }
}

export interface CoachLlm {
  explainRecommendations(
    input: CoachExplanationInput,
    signal?: AbortSignal,
  ): Promise<CoachExplanationResult>
  guideModule(input: CoachModuleGuideInput, signal?: AbortSignal): Promise<string[]>
  answerQuestion(input: CoachAskInput, signal?: AbortSignal): Promise<string>
}

export interface CoachExplanationInput {
  recommendations: readonly CoachRecommendation[]
  assessmentData: CoachAssessmentAvailability
}

export interface CoachExplanationResult {
  headline: string
  /** Validated explanation keyed by the exact deterministic module slug. */
  explanations: Map<string, string>
}

export interface CoachModuleGuideInput {
  moduleSlug: string
  moduleName: string
  progressPct: number
  inPlan: boolean
  skills: readonly string[]
  assessmentData: CoachAssessmentAvailability
}

export interface CoachAskInput {
  question: string
  focusModuleSlug?: string
  recommendations: readonly CoachRecommendation[]
  assessmentData: CoachAssessmentAvailability
}

interface GeminiClientOptions {
  apiKey: string | undefined
  model: string
  timeoutMs: number
}

const CoachExplanationResponseSchema = z.object({
  headline: z.string().trim().min(1).max(240),
  recommendations: z
    .array(
      z.object({
        moduleSlug: z.string().trim().min(1),
        explanation: z.string().trim().min(1).max(700),
      }),
    )
    .min(1)
    .max(3),
})

const ModuleGuideResponseSchema = z.object({
  guidance: z.array(z.string().trim().min(1).max(300)).min(3).max(5),
})

const AskResponseSchema = z.object({
  answer: z.string().trim().min(1).max(900),
})

const ExplainResponseJsonSchema = {
  type: 'object',
  properties: {
    headline: { type: 'string' },
    recommendations: {
      type: 'array',
      minItems: 1,
      maxItems: 3,
      items: {
        type: 'object',
        properties: {
          moduleSlug: { type: 'string' },
          explanation: { type: 'string' },
        },
        required: ['moduleSlug', 'explanation'],
        additionalProperties: false,
      },
    },
  },
  required: ['headline', 'recommendations'],
  additionalProperties: false,
} as const

const GuideResponseJsonSchema = {
  type: 'object',
  properties: {
    guidance: {
      type: 'array',
      minItems: 3,
      maxItems: 5,
      items: { type: 'string' },
    },
  },
  required: ['guidance'],
  additionalProperties: false,
} as const

const AskResponseJsonSchema = {
  type: 'object',
  properties: {
    answer: { type: 'string' },
  },
  required: ['answer'],
  additionalProperties: false,
} as const

const FORBIDDEN_CLAIM_PATTERNS: readonly RegExp[] = [
  // Quiz, assessment or coding-question scores and results.
  /\b(?:quiz|assessment|coding[- ]question|test)s?\b[^.]{0,80}\b(?:score|mark|grade|result)\b[^.]{0,80}\b\d{1,3}\s*%/i,
  /\b(?:you|student)\b[^.]{0,80}\b(?:scored|got|received|achieved)\b[^.]{0,80}\b\d{1,3}\s*%/i,
  /\b\d{1,3}\s*%\s*(?:on|in)\b[^.]{0,40}\b(?:quiz|assessment|coding|test)\b/i,
  // Specific incorrect or wrong questions/answers.
  /\b(?:incorrect|wrong)\s+(?:answers?|questions?)\b/i,
  /\b(?:question|questions?)\s+(?:number\s+)?\d+\b[^.]{0,60}\b(?:incorrect(?:ly)?|wrong(?:ly)?|right|correct)\b/i,
  /\b(?:you|student)\b[^.]{0,40}\b(?:answered|got|marked)\b[^.]{0,40}\b(?:incorrect(?:ly)?|wrong(?:ly)?)\b/i,
  // Specific attempt or completion counts for learning activities.
  /\b(?:attempted|tried|submitted|solved|completed)\b[^.]{0,30}\b\d+\b[^.]{0,20}\b(?:coding[- ]questions?|questions?)\b/i,
  /\b\d+\s+(?:coding[- ]questions?|quizzes?|assessments?|questions?|tests?)\b[^.]{0,40}\b(?:attempted|submitted|solved|completed)\b/i,
  /\b(?:you|student)\b[^.]{0,40}\b(?:attempted|submitted|solved|completed)\b[^.]{0,30}\b(?:coding[- ]questions?|quizzes?|assessments?|tests?)\b/i,
  // Pending, failed or passed statuses.
  /\b(?:pending|unsubmitted|unattempted|failed|passed)\b[^.]{0,60}\b(?:quiz|assessment|coding[- ]question|test)\b/i,
  /\b(?:quiz|assessment|coding[- ]question|test)\b[^.]{0,60}\b(?:pending|unsubmitted|unattempted|failed|passed)\b/i,
  // Personal eligibility claims.
  /\b(?:you|student)\b[^.]{0,50}\b(?:are|is|meet|meets|satisfy|satisfies)\b[^.]{0,40}\b(?:eligible|eligibility)\b/i,
  /\b(?:eligible|eligibility)\b[^.]{0,50}\b(?:confirmed|approved|granted|met)\b/i,
  // Invented durations, assignments, challenges and external resources.
  /\b\d+\s*(?:minutes?|hours?|days?|weeks?)\b/i,
  /\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|couple|few)\s+(?:minutes?|hours?|days?|weeks?)\b/i,
  /\b(?:an?|a)\s+(?:minute|hour|day|week)\b/i,
  /\bassignment\b/i,
  /\bchallenge\b/i,
  /\b(?:external|additional|recommended|curated|supplementary)\b[^.]{0,40}\b(?:resources?|courses?|tutorials?|articles?|books?|videos?|websites?)\b/i,
]

export function containsUnsupportedClaim(text: string): boolean {
  return FORBIDDEN_CLAIM_PATTERNS.some((pattern) => pattern.test(text))
}

function ensureSafeText(text: string, failureReason: CoachLlmFailure = 'invalid_output'): string {
  if (containsUnsupportedClaim(text)) {
    throw new CoachLlmError(
      failureReason,
      'Gemini returned a claim that is not supported by available data.',
    )
  }
  return text
}

function stripCodeFence(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed.startsWith('```')) return trimmed
  return trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()
}

function parseJson(raw: string): unknown {
  const text = stripCodeFence(raw)
  try {
    return JSON.parse(text)
  } catch {
    throw new CoachLlmError('invalid_output', 'Gemini did not return valid JSON.')
  }
}

export function mapGeminiError(error: unknown): CoachLlmError {
  if (error instanceof CoachLlmError) return error

  const name = error instanceof Error ? error.name : ''
  if (name === 'AbortError' || name === 'TimeoutError') {
    return new CoachLlmError('timeout', 'Gemini request timed out.')
  }

  const candidate = error as { status?: unknown; code?: unknown; message?: unknown }
  const status = typeof candidate.status === 'number' ? candidate.status : candidate.code
  if (status === 429) {
    return new CoachLlmError('rate_limit', 'Gemini free-tier rate limit reached.')
  }
  if (status === 404) {
    return new CoachLlmError('model_unavailable', 'The configured Gemini model is unavailable.')
  }

  const message = typeof candidate.message === 'string' ? candidate.message : 'Gemini request failed.'
  if (/quota|rate limit|too many requests/i.test(message)) {
    return new CoachLlmError('rate_limit', 'Gemini free-tier rate limit reached.')
  }
  if (/not found|no longer available|unsupported model/i.test(message)) {
    return new CoachLlmError('model_unavailable', 'The configured Gemini model is unavailable.')
  }
  return new CoachLlmError('api_error', message)
}

function mergeSignals(timeoutMs: number, external?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs)
  return external ? AbortSignal.any([timeout, external]) : timeout
}

function promptContext(
  recommendations: readonly CoachRecommendation[],
  assessmentData: CoachAssessmentAvailability,
  focusModuleSlug?: string,
): string {
  return JSON.stringify(
    {
      task: 'Explain the deterministic module recommendations for a student.',
      privacy: 'No student name, email, id or record history is supplied.',
      focusModuleSlug: focusModuleSlug ?? null,
      assessmentData,
      recommendations: recommendations.map((recommendation) => ({
        moduleSlug: recommendation.moduleSlug,
        moduleName: recommendation.moduleName,
        track: recommendation.track,
        type: recommendation.type,
        progressPct: recommendation.progressPct,
        inPlan: recommendation.inPlan,
        deterministicReason: recommendation.reason,
        skills: recommendation.skills.map((skill) => ({
          name: skill.name,
          importance: skill.importance,
        })),
      })),
    },
    null,
    2,
  )
}

const COACH_SYSTEM_INSTRUCTION = `You are the AI Skill Coach for a student learning dashboard.
You explain recommendations that were already selected deterministically. You do not choose or change the modules.

Hard rules:
- Use only the supplied module progress, module names, tracks, skills and assessment availability.
- Never invent quiz marks, assessment scores, coding-question results, completion states, pending activities, challenges, assignments, resources or time estimates.
- The individual status of quizzes, coding questions, mid-course assessments and end-course assessments is unavailable. If you mention them, state clearly that their individual status is unavailable.
- You may give general advice about continuing module content, reviewing concepts, using existing quizzes for revision, completing existing coding questions where applicable, and attempting assessments under their published eligibility rules.
- Do not mention student names, emails or any personal data. None is supplied.
- Keep explanations concise, concrete and encouraging.
- Return JSON only, with no markdown fences, using exactly this shape:
  {"headline":"...","recommendations":[{"moduleSlug":"<exact supplied moduleSlug>","explanation":"..."}]}
- Include every supplied recommendation once, in the same order, and use its exact moduleSlug.`

const GUIDE_SYSTEM_INSTRUCTION = `You are the AI Skill Coach for a student learning dashboard.
Write short, practical guidance for completing one existing module using only the supplied verified fields.

Hard rules:
- Do not invent quizzes, questions, assignments, challenges, resources or time estimates.
- Do not claim to know which specific activities are complete or pending.
- You may mention continuing remaining module content, reviewing the listed concepts, using the module's existing quizzes for revision, completing existing coding questions where applicable, and attempting assessments under their published eligibility requirements.
- Always state that individual quiz, coding-question and assessment status is unavailable when referring to them.
- Return JSON only: {"guidance":["..."]} with 3 to 5 bullets. No markdown fences.`

const ASK_SYSTEM_INSTRUCTION = `You are the AI Skill Coach for a student learning dashboard.
Answer the student's short question using only the supplied recommendation and progress context.

Hard rules:
- Never invent quiz marks, assessment scores, coding results, pending work, challenges, assignments, resources or time estimates.
- Individual quiz, coding-question and assessment status is unavailable; say so explicitly when relevant.
- Do not mention personal data. None is supplied.
- Keep the answer under 120 words.
- Return JSON only: {"answer":"..."}. No markdown fences.`

export class GeminiCoachLlm implements CoachLlm {
  private readonly client: GoogleGenAI | null

  constructor(private readonly options: GeminiClientOptions) {
    this.client = options.apiKey
      ? new GoogleGenAI({ apiKey: options.apiKey })
      : null
  }

  private getClient(): GoogleGenAI {
    if (!this.client) {
      throw new CoachLlmError('not_configured', 'GEMINI_API_KEY is not configured.')
    }
    return this.client
  }

  private async generateJson(
    systemInstruction: string,
    contents: string,
    maxOutputTokens: number,
    responseJsonSchema: unknown,
    signal?: AbortSignal,
  ): Promise<string> {
    const client = this.getClient()
    const abortSignal = mergeSignals(this.options.timeoutMs, signal)

    try {
      const response = await client.models.generateContent({
        model: this.options.model,
        contents,
        config: {
          systemInstruction,
          temperature: 0.2,
          maxOutputTokens,
          responseMimeType: 'application/json',
          responseJsonSchema,
          abortSignal,
        },
      })
      const text = response.text
      if (!text) {
        throw new CoachLlmError('invalid_output', 'Gemini returned an empty response.')
      }
      return text
    } catch (error) {
      throw mapGeminiError(error)
    }
  }

  async explainRecommendations(
    input: CoachExplanationInput,
    signal?: AbortSignal,
  ): Promise<CoachExplanationResult> {
    if (input.recommendations.length === 0) {
      throw new CoachLlmError('invalid_output', 'No recommendations were supplied.')
    }

    const raw = await this.generateJson(
      COACH_SYSTEM_INSTRUCTION,
      promptContext(input.recommendations, input.assessmentData),
      900,
      ExplainResponseJsonSchema,
      signal,
    )

    const parsed = CoachExplanationResponseSchema.safeParse(parseJson(raw))
    if (!parsed.success) {
      throw new CoachLlmError('invalid_output', 'Gemini response did not match the coach schema.')
    }

    const expectedSlugs = input.recommendations.map((entry) => entry.moduleSlug)
    const returnedSlugs = parsed.data.recommendations.map((entry) => entry.moduleSlug)
    const sameOrder =
      expectedSlugs.length === returnedSlugs.length &&
      expectedSlugs.every((slug, index) => slug === returnedSlugs[index])
    if (!sameOrder) {
      throw new CoachLlmError(
        'invalid_output',
        'Gemini response changed the deterministic recommendation set.',
      )
    }

    const explanations = new Map<string, string>()
    for (const entry of parsed.data.recommendations) {
      explanations.set(entry.moduleSlug, ensureSafeText(entry.explanation))
    }
    ensureSafeText(parsed.data.headline)

    return { headline: parsed.data.headline, explanations }
  }

  async guideModule(input: CoachModuleGuideInput, signal?: AbortSignal): Promise<string[]> {
    const contents = JSON.stringify(
      {
        task: 'Give general guidance for completing this existing module.',
        moduleSlug: input.moduleSlug,
        moduleName: input.moduleName,
        progressPct: input.progressPct,
        inPlan: input.inPlan,
        skills: input.skills,
        assessmentData: input.assessmentData,
      },
      null,
      2,
    )
    const raw = await this.generateJson(
      GUIDE_SYSTEM_INSTRUCTION,
      contents,
      500,
      GuideResponseJsonSchema,
      signal,
    )
    const parsed = ModuleGuideResponseSchema.safeParse(parseJson(raw))
    if (!parsed.success) {
      throw new CoachLlmError('invalid_output', 'Gemini guide did not match the schema.')
    }
    return parsed.data.guidance.map((entry) => ensureSafeText(entry))
  }

  async answerQuestion(input: CoachAskInput, signal?: AbortSignal): Promise<string> {
    const contents = JSON.stringify(
      {
        task: 'Answer the student question using the supplied recommendation context only.',
        question: input.question,
        focusModuleSlug: input.focusModuleSlug ?? null,
        assessmentData: input.assessmentData,
        recommendations: input.recommendations.map((entry) => ({
          moduleSlug: entry.moduleSlug,
          moduleName: entry.moduleName,
          type: entry.type,
          progressPct: entry.progressPct,
          inPlan: entry.inPlan,
          deterministicReason: entry.reason,
          skills: entry.skills.map((skill) => skill.name),
        })),
      },
      null,
      2,
    )
    const raw = await this.generateJson(
      ASK_SYSTEM_INSTRUCTION,
      contents,
      600,
      AskResponseJsonSchema,
      signal,
    )
    const parsed = AskResponseSchema.safeParse(parseJson(raw))
    if (!parsed.success) {
      throw new CoachLlmError('invalid_output', 'Gemini answer did not match the schema.')
    }
    return ensureSafeText(parsed.data.answer)
  }
}

export function createGeminiCoachLlm(options: {
  provider: 'gemini' | 'disabled'
  apiKey: string | undefined
  model: string
  timeoutMs: number
}): CoachLlm | null {
  if (options.provider === 'disabled' || !options.apiKey) return null
  return new GeminiCoachLlm({
    apiKey: options.apiKey,
    model: options.model,
    timeoutMs: options.timeoutMs,
  })
}
