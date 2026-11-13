import type { CoachAssessmentAvailability } from '@spd/shared'
import { ASSESSMENT_UNAVAILABLE_NOTE } from './constants'

/**
 * Assessment results are not exposed by the current learning-platform API.
 * This adapter is the single integration point for a future verified source.
 * Until then it must stay unavailable: no quiz marks, coding-question
 * results, or assessment completion states may be fabricated.
 */
export interface AssessmentDataAdapter {
  getAssessmentAvailability(): Promise<CoachAssessmentAvailability>
}

export class UnavailableAssessmentDataAdapter implements AssessmentDataAdapter {
  async getAssessmentAvailability(): Promise<CoachAssessmentAvailability> {
    return {
      available: false,
      quizzes: 'unavailable',
      codingQuestions: 'unavailable',
      midCourseAssessments: 'unavailable',
      endCourseAssessments: 'unavailable',
      note: ASSESSMENT_UNAVAILABLE_NOTE,
    }
  }
}

export const unavailableAssessmentDataAdapter = new UnavailableAssessmentDataAdapter()
