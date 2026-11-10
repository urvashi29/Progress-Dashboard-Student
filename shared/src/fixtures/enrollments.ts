import type { Enrollment } from '../enrollments'

/**
 * Fictional enrollments. `overallProgressPct` is the platform-reported value
 * and is intentionally not the average of module progress.
 */
export const MOCK_ENROLLMENTS: Enrollment[] = [
  {
    id: 1,
    studentId: 1,
    cohort: 'DS-2025-A',
    planType: 'Data Science',
    subPlanType: 'Self Paced',
    courseType: 'data-science',
    cohortStartDate: '2025-08-01',
    enrolledAt: '2025-08-01',
    accessExpiryDate: '2026-05-01',
    overallProgressPct: 34,
    progressUpdatedAt: '2025-12-20',
    importId: null,
  },
  {
    id: 2,
    studentId: 2,
    cohort: 'DS-2025-A',
    planType: 'Data Science',
    subPlanType: 'Mentored',
    courseType: 'data-science',
    cohortStartDate: '2025-08-01',
    enrolledAt: '2025-08-02',
    accessExpiryDate: '2026-05-01',
    overallProgressPct: 71,
    progressUpdatedAt: '2026-01-05',
    importId: null,
  },
  {
    id: 3,
    studentId: 3,
    cohort: 'DS-2025-B',
    planType: 'Data Science',
    subPlanType: null,
    courseType: 'data-science',
    cohortStartDate: '2025-12-01',
    enrolledAt: '2025-12-01',
    accessExpiryDate: '2026-09-01',
    overallProgressPct: 8,
    progressUpdatedAt: '2026-01-10',
    importId: null,
  },
]

export function getMockEnrollment(id: number): Enrollment {
  const enrollment = MOCK_ENROLLMENTS.find((entry) => entry.id === id)
  if (!enrollment) throw new Error(`Unknown mock enrollment id: ${id}`)
  return enrollment
}
