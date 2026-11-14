import fs from 'node:fs'
import path from 'node:path'
import { GoogleGenAI } from '@google/genai'
import { MOCK_ENROLLMENTS, MOCK_MODULE_PROGRESS } from '@spd/shared'
import dotenv from 'dotenv'
import { describe, expect, it } from 'vitest'
import { unavailableAssessmentDataAdapter } from '../src/coach/assessment-adapter'
import { createGeminiCoachLlm } from '../src/coach/gemini'
import { buildDeterministicRecommendations } from '../src/coach/recommendations'

const repoRoot = path.resolve(__dirname, '../..')
const envPath = path.join(repoRoot, '.env')
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, override: false })
}

const apiKey = process.env.GEMINI_API_KEY
const model = process.env.GEMINI_MODEL ?? 'gemini-3.5-flash-lite'
const enabled = process.env.RUN_GEMINI_TESTS === '1' && Boolean(apiKey)

describe.skipIf(!enabled)('live Gemini connectivity', () => {
  it(`generates a short response with ${model}`, async () => {
    const client = new GoogleGenAI({ apiKey })
    const response = await client.models.generateContent({
      model,
      contents: 'Reply with the single word OK.',
      config: { maxOutputTokens: 8, temperature: 0 },
    })
    expect(response.text?.trim()).toContain('OK')
  })

  it('generates validated explanations for fictional module progress', async () => {
    const llm = createGeminiCoachLlm({
      provider: 'gemini',
      apiKey,
      model,
      timeoutMs: 20_000,
    })
    expect(llm).not.toBeNull()

    const enrollment = MOCK_ENROLLMENTS[0]!
    const recommendations = buildDeterministicRecommendations({
      enrollment,
      moduleProgress: MOCK_MODULE_PROGRESS.filter(
        (record) => record.enrollmentId === enrollment.id,
      ),
    })
    expect(recommendations.length).toBeGreaterThan(0)

    const result = await llm!.explainRecommendations({
      recommendations,
      assessmentData: await unavailableAssessmentDataAdapter.getAssessmentAvailability(),
    })

    expect(result.headline.length).toBeGreaterThan(0)
    expect(result.explanations.size).toBe(recommendations.length)
    for (const recommendation of recommendations) {
      expect(result.explanations.get(recommendation.moduleSlug)?.length).toBeGreaterThan(0)
    }

    const guidance = await llm!.guideModule({
      moduleSlug: recommendations[0]!.moduleSlug,
      moduleName: recommendations[0]!.moduleName,
      progressPct: recommendations[0]!.progressPct,
      inPlan: recommendations[0]!.inPlan,
      skills: recommendations[0]!.skills.map((skill) => skill.name),
      assessmentData: await unavailableAssessmentDataAdapter.getAssessmentAvailability(),
    })
    expect(guidance.length).toBeGreaterThanOrEqual(3)

    const answer = await llm!.answerQuestion({
      question: 'What should I focus on next?',
      recommendations,
      assessmentData: await unavailableAssessmentDataAdapter.getAssessmentAvailability(),
    })
    expect(answer.length).toBeGreaterThan(0)
  }, 30_000)
})
