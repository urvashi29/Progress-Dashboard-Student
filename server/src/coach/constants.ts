export const COACH_DISCLAIMER =
  'Recommendations are selected deterministically from actual module completion data and approved curriculum mappings. Gemini only explains them. Individual quiz, coding-question and assessment results are not available.'

export const ASSESSMENT_UNAVAILABLE_NOTE =
  'Individual quiz, coding-question, mid-course assessment and end-course assessment results are not available through the current backend API. The coach can describe the platform activities in general terms but cannot confirm which ones you have completed or pending.'

export const UNAVAILABLE_ASSESSMENT_DATA = {
  available: false as const,
  quizzes: 'unavailable' as const,
  codingQuestions: 'unavailable' as const,
  midCourseAssessments: 'unavailable' as const,
  endCourseAssessments: 'unavailable' as const,
  note: ASSESSMENT_UNAVAILABLE_NOTE,
}
