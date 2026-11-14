import {
  CoachAskResponseSchema,
  CoachModuleGuideSchema,
  CoachSummarySchema,
} from '@spd/shared'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp, type CreateAppOptions } from '../src/app'
import { CoachLlmError, mapGeminiError, type CoachLlm } from '../src/coach/gemini'
import { CoachRateLimiter } from '../src/coach/rate-limit'
import { createFixtureRepositories } from '../src/repositories/fixture'

const NOW = new Date('2026-02-04T09:00:00+05:30')

class FakeCoachLlm implements CoachLlm {
  readonly calls: unknown[] = []

  constructor(private readonly behavior: 'ok' | 'timeout' | 'invalid' = 'ok') {}

  async explainRecommendations(input: Parameters<CoachLlm['explainRecommendations']>[0]) {
    this.calls.push(input)
    if (this.behavior === 'timeout') {
      throw new CoachLlmError('timeout', 'timed out')
    }
    if (this.behavior === 'invalid') {
      throw new CoachLlmError('invalid_output', 'bad output')
    }
    return {
      headline: 'Gemini headline for the next modules.',
      explanations: new Map(
        input.recommendations.map((recommendation) => [
          recommendation.moduleSlug,
          `Gemini explanation for ${recommendation.moduleSlug}.`,
        ]),
      ),
    }
  }

  async guideModule(input: Parameters<CoachLlm['guideModule']>[0]) {
    this.calls.push(input)
    if (this.behavior === 'timeout') throw new CoachLlmError('timeout', 'timed out')
    if (this.behavior === 'invalid') throw new CoachLlmError('invalid_output', 'bad output')
    return [
      `Continue the remaining content in ${input.moduleName}.`,
      'Review the listed module concepts.',
      'Use the existing quizzes for revision; individual quiz status is unavailable.',
    ]
  }

  async answerQuestion(input: Parameters<CoachLlm['answerQuestion']>[0]) {
    this.calls.push(input)
    if (this.behavior === 'timeout') throw new CoachLlmError('timeout', 'timed out')
    if (this.behavior === 'invalid') throw new CoachLlmError('invalid_output', 'bad output')
    return 'Continue the first recommended module.'
  }
}

function testApp(options: {
  studentId?: number | null
  llm?: CoachLlm | null
  rateLimiter?: CoachRateLimiter
  askRateLimiter?: CoachRateLimiter
} = {}) {
  const appOptions: CreateAppOptions = {
    repositories: createFixtureRepositories(),
    clock: { now: () => NOW },
    identityResolver: () => options.studentId ?? null,
    timeZone: 'Asia/Kolkata',
    coach: {
      llm: options.llm === undefined ? null : options.llm,
      rateLimiter: options.rateLimiter,
      askRateLimiter: options.askRateLimiter,
    },
  }
  return createApp(appOptions)
}

describe('GET /api/v1/me/coach', () => {
  it('returns three deterministic recommendations from actual module progress', async () => {
    const agent = request(testApp({ studentId: 1 }))
    const first = await agent.get('/api/v1/me/coach')
    const second = await agent.get('/api/v1/me/coach')

    expect(first.status).toBe(200)
    const coach = CoachSummarySchema.parse(first.body)
    expect(coach.recommendations).toHaveLength(3)
    expect(coach.generatedBy).toBe('fallback')
    expect(coach.recommendations[0]).toMatchObject({
      moduleSlug: 'numerical-programming-in-python',
      type: 'NEAR_FINISH',
      progressPct: 80,
      action: 'CONTINUE_MODULE',
    })
    expect(coach.recommendations.every((entry) => entry.estimatedMinutes === null)).toBe(true)
    expect(coach.recommendations.every((entry) => entry.expectedGainPct === null)).toBe(true)
    expect(coach.assessmentData.available).toBe(false)
    expect(first.body).toEqual(second.body)
  })

  it('uses Gemini only to explain the deterministic module set', async () => {
    const llm = new FakeCoachLlm('ok')
    const response = await request(testApp({ studentId: 1, llm })).get('/api/v1/me/coach')

    expect(response.status).toBe(200)
    const coach = CoachSummarySchema.parse(response.body)
    expect(coach.generatedBy).toBe('gemini')
    expect(coach.headline).toBe('Gemini headline for the next modules.')
    expect(coach.recommendations.map((entry) => entry.moduleSlug)).toEqual([
      'numerical-programming-in-python',
      'relational-databases',
      'advanced-machine-learning',
    ])
    expect(coach.recommendations[0]?.explanation).toBe(
      'Gemini explanation for numerical-programming-in-python.',
    )

    const prompt = JSON.stringify(llm.calls[0])
    expect(prompt).not.toContain('Aanya')
    expect(prompt).not.toContain('aanya.fictional@example.com')
    expect(prompt).not.toContain('studentId')
    expect(prompt).not.toContain('enrollmentId')
  })

  it('falls back deterministically when Gemini times out or returns invalid output', async () => {
    for (const behavior of ['timeout', 'invalid'] as const) {
      const response = await request(
        testApp({ studentId: 1, llm: new FakeCoachLlm(behavior) }),
      ).get('/api/v1/me/coach')

      expect(response.status).toBe(200)
      const coach = CoachSummarySchema.parse(response.body)
      expect(coach.generatedBy).toBe('fallback')
      expect(coach.recommendations).toHaveLength(3)
      expect(coach.recommendations[0]?.explanation).toContain('80% complete')
    }
  })

  it('isolates students and never returns names or emails in coach data', async () => {
    const first = CoachSummarySchema.parse(
      (await request(testApp({ studentId: 1 })).get('/api/v1/me/coach')).body,
    )
    const second = CoachSummarySchema.parse(
      (await request(testApp({ studentId: 2 })).get('/api/v1/me/coach')).body,
    )

    expect(JSON.stringify(first)).not.toEqual(JSON.stringify(second))
    const serialized = JSON.stringify(first)
    expect(serialized).not.toContain('Aanya')
    expect(serialized).not.toContain('example.com')
  })

  it('rejects unauthenticated requests', async () => {
    const response = await request(testApp({ studentId: null })).get('/api/v1/me/coach')
    expect(response.status).toBe(401)
    expect(response.body).toMatchObject({ error: 'unauthenticated' })
  })

  it('enforces the coach rate limit', async () => {
    const limiter = new CoachRateLimiter(1, 60_000, () => NOW.getTime())
    const app = testApp({ studentId: 1, rateLimiter: limiter })

    expect((await request(app).get('/api/v1/me/coach')).status).toBe(200)
    const limited = await request(app).get('/api/v1/me/coach')
    expect(limited.status).toBe(429)
    expect(limited.body.error).toBe('coach_rate_limited')
    expect(limited.headers['retry-after']).toBeDefined()
  })
})

describe('POST /api/v1/me/coach/modules/:slug/guide', () => {
  it('returns verified how-to guidance without fabricated results', async () => {
    const response = await request(testApp({ studentId: 1 })).post(
      '/api/v1/me/coach/modules/relational-databases/guide',
    )

    expect(response.status).toBe(200)
    const guide = CoachModuleGuideSchema.parse(response.body)
    expect(guide.moduleSlug).toBe('relational-databases')
    expect(guide.progressPct).toBe(35)
    expect(guide.guidance.length).toBeGreaterThanOrEqual(3)
    expect(guide.guidance.join(' ')).toMatch(/individual quiz status is not available/i)
    expect(guide.guidance.join(' ')).not.toMatch(/scored \d+%/i)
    expect(guide.assessmentData.available).toBe(false)
    expect(guide.generatedBy).toBe('fallback')
  })

  it('uses Gemini guidance when available and falls back otherwise', async () => {
    const success = CoachModuleGuideSchema.parse(
      (
        await request(testApp({ studentId: 1, llm: new FakeCoachLlm('ok') })).post(
          '/api/v1/me/coach/modules/relational-databases/guide',
        )
      ).body,
    )
    expect(success.generatedBy).toBe('gemini')
    expect(success.guidance[0]).toContain('Relational Databases')

    const fallback = CoachModuleGuideSchema.parse(
      (
        await request(testApp({ studentId: 1, llm: new FakeCoachLlm('invalid') })).post(
          '/api/v1/me/coach/modules/relational-databases/guide',
        )
      ).body,
    )
    expect(fallback.generatedBy).toBe('fallback')
  })

  it('requires authentication', async () => {
    const response = await request(testApp({ studentId: null })).post(
      '/api/v1/me/coach/modules/relational-databases/guide',
    )
    expect(response.status).toBe(401)
  })

  it('enforces the guide rate limit', async () => {
    const limiter = new CoachRateLimiter(1, 60_000, () => NOW.getTime())
    const app = testApp({ studentId: 1, askRateLimiter: limiter })

    expect(
      (
        await request(app).post('/api/v1/me/coach/modules/relational-databases/guide')
      ).status,
    ).toBe(200)
    const limited = await request(app).post(
      '/api/v1/me/coach/modules/relational-databases/guide',
    )
    expect(limited.status).toBe(429)
    expect(limited.body.error).toBe('coach_rate_limited')
  })

  it('returns 404 for an unknown module', async () => {
    const response = await request(testApp({ studentId: 1 })).post(
      '/api/v1/me/coach/modules/not-a-real-module/guide',
    )
    expect(response.status).toBe(404)
  })
})

describe('POST /api/v1/me/coach/ask', () => {
  it('answers with contextual recommendations and assessment limitations', async () => {
    const response = await request(testApp({ studentId: 1 }))
      .post('/api/v1/me/coach/ask')
      .send({ question: 'What should I do next?' })

    expect(response.status).toBe(200)
    const answer = CoachAskResponseSchema.parse(response.body)
    expect(answer.generatedBy).toBe('fallback')
    expect(answer.contextModuleSlugs).toContain('numerical-programming-in-python')
    expect(answer.answer).toMatch(/quiz/i)
    expect(answer.assessmentData.available).toBe(false)
  })

  it('uses Gemini for the answer when available', async () => {
    const response = await request(testApp({ studentId: 1, llm: new FakeCoachLlm('ok') }))
      .post('/api/v1/me/coach/ask')
      .send({ question: 'What should I do next?', moduleSlug: 'relational-databases' })

    const answer = CoachAskResponseSchema.parse(response.body)
    expect(answer.generatedBy).toBe('gemini')
    expect(answer.answer).toBe('Continue the first recommended module.')
  })

  it('falls back deterministically when Gemini times out or returns invalid output', async () => {
    for (const behavior of ['timeout', 'invalid'] as const) {
      const response = await request(
        testApp({ studentId: 1, llm: new FakeCoachLlm(behavior) }),
      )
        .post('/api/v1/me/coach/ask')
        .send({ question: 'What should I do next?' })

      expect(response.status).toBe(200)
      const answer = CoachAskResponseSchema.parse(response.body)
      expect(answer.generatedBy).toBe('fallback')
      expect(answer.answer).toMatch(/actual module progress/i)
    }
  })

  it('enforces the ask rate limit', async () => {
    const limiter = new CoachRateLimiter(1, 60_000, () => NOW.getTime())
    const app = testApp({ studentId: 1, askRateLimiter: limiter })

    expect(
      (
        await request(app)
          .post('/api/v1/me/coach/ask')
          .send({ question: 'What should I do next?' })
      ).status,
    ).toBe(200)
    const limited = await request(app)
      .post('/api/v1/me/coach/ask')
      .send({ question: 'What should I do next?' })
    expect(limited.status).toBe(429)
    expect(limited.body.error).toBe('coach_rate_limited')
  })

  it('validates the question and requires authentication', async () => {
    expect(
      (
        await request(testApp({ studentId: 1 }))
          .post('/api/v1/me/coach/ask')
          .send({ question: '' })
      ).status,
    ).toBe(400)
    expect(
      (
        await request(testApp({ studentId: null }))
          .post('/api/v1/me/coach/ask')
          .send({ question: 'What next?' })
      ).status,
    ).toBe(401)
  })
})

describe('Gemini failure classification', () => {
  it('classifies free-tier rate limits, missing models and timeouts', () => {
    expect(mapGeminiError({ status: 429 }).reason).toBe('rate_limit')
    expect(mapGeminiError({ status: 404 }).reason).toBe('model_unavailable')
    const timeout = new Error('aborted')
    timeout.name = 'AbortError'
    expect(mapGeminiError(timeout).reason).toBe('timeout')
    expect(mapGeminiError(new Error('boom')).reason).toBe('api_error')
  })
})
