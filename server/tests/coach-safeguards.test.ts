import { describe, expect, it } from 'vitest'
import { containsUnsupportedClaim } from '../src/coach/gemini'
import { COACH_DISCLAIMER } from '../src/coach/constants'

const FORBIDDEN_EXAMPLES = [
  'You scored 85% on the quiz.',
  'Your assessment result was 92%.',
  'You answered question 4 incorrectly.',
  'The wrong questions were 2 and 7.',
  'You attempted 3 coding questions.',
  'You submitted 2 assessments.',
  'Your mid-course assessment is pending.',
  'You failed the end-course assessment.',
  'You are eligible for the end-course assessment.',
  'You meet the eligibility requirements for the final test.',
  'Complete the practice challenge this week.',
  'Start the new assignment before the next module.',
  'Use these external resources to learn more.',
  'This should take about 2 hours.',
  'You need about three days to finish.',
  'Plan for a week of study.',
] as const

const ALLOWED_EXAMPLES = [
  'Continue the remaining module content in Numerical Programming in Python.',
  "Use the module's existing quizzes for revision; individual quiz status is not available.",
  'If the module includes coding questions, complete the existing ones; individual coding-question status is not available.',
  "Attempt the platform's assessments according to their published eligibility requirements; individual assessment status is not available.",
  'Review SQL joins, schema design and normalization.',
  COACH_DISCLAIMER,
] as const

describe('assessment and activity guidance safeguards', () => {
  it.each(FORBIDDEN_EXAMPLES)('rejects unsupported claim: %s', (text) => {
    expect(containsUnsupportedClaim(text)).toBe(true)
  })

  it.each(ALLOWED_EXAMPLES)('allows general guidance: %s', (text) => {
    expect(containsUnsupportedClaim(text)).toBe(false)
  })

  it('keeps the assessment availability disclaimer explicit', () => {
    expect(COACH_DISCLAIMER).toMatch(/quiz/i)
    expect(COACH_DISCLAIMER).toMatch(/coding-question/i)
    expect(COACH_DISCLAIMER).toMatch(/assessment/i)
    expect(COACH_DISCLAIMER).toMatch(/not available/i)
  })
})
