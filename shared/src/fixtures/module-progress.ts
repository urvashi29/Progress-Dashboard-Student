import type { ModuleProgressRecord } from '../modules'

/**
 * Fictional module progress. Rows are intentionally out of catalog order to
 * prove that modules are identified by slug/normalized name, never column
 * position. `inPlan: false` means the module was absent from the student's
 * row; it is distinct from an in-plan module with real 0% progress.
 */
export const MOCK_MODULE_PROGRESS: ModuleProgressRecord[] = [
  { enrollmentId: 1, moduleSlug: 'relational-databases', progressPct: 35, inPlan: true, updatedAt: '2025-12-20' },
  { enrollmentId: 1, moduleSlug: 'dl-for-nlp', progressPct: 0, inPlan: true, updatedAt: '2025-12-20' },
  { enrollmentId: 1, moduleSlug: 'intro-to-computer-programming', progressPct: 100, inPlan: true, updatedAt: '2025-12-20' },
  { enrollmentId: 1, moduleSlug: 'distributed-ml', progressPct: 0, inPlan: false, updatedAt: '2025-12-20' },
  { enrollmentId: 1, moduleSlug: 'numerical-programming-in-python', progressPct: 80, inPlan: true, updatedAt: '2025-12-20' },
  { enrollmentId: 1, moduleSlug: 'data-visualization-tools', progressPct: 40, inPlan: true, updatedAt: '2025-12-20' },
  { enrollmentId: 1, moduleSlug: 'dl-for-computer-vision', progressPct: 0, inPlan: true, updatedAt: '2025-12-20' },
  { enrollmentId: 1, moduleSlug: 'applied-business-analytics', progressPct: 0, inPlan: true, updatedAt: '2025-12-20' },
  { enrollmentId: 1, moduleSlug: 'industry-immersion', progressPct: 0, inPlan: false, updatedAt: '2025-12-20' },
  { enrollmentId: 1, moduleSlug: 'advanced-machine-learning', progressPct: 20, inPlan: true, updatedAt: '2025-12-20' },
  { enrollmentId: 1, moduleSlug: 'ml-genai-with-microsoft-azure', progressPct: 10, inPlan: true, updatedAt: '2025-12-20' },
  { enrollmentId: 1, moduleSlug: 'intro-to-deep-learning', progressPct: 0, inPlan: true, updatedAt: '2025-12-20' },
  { enrollmentId: 1, moduleSlug: 'productionization-of-ml-systems', progressPct: 0, inPlan: true, updatedAt: '2025-12-20' },

  { enrollmentId: 2, moduleSlug: 'intro-to-computer-programming', progressPct: 100, inPlan: true, updatedAt: '2026-01-05' },
  { enrollmentId: 2, moduleSlug: 'numerical-programming-in-python', progressPct: 95, inPlan: true, updatedAt: '2026-01-05' },
  { enrollmentId: 2, moduleSlug: 'relational-databases', progressPct: 90, inPlan: true, updatedAt: '2026-01-05' },
  { enrollmentId: 2, moduleSlug: 'data-visualization-tools', progressPct: 85, inPlan: true, updatedAt: '2026-01-05' },
  { enrollmentId: 2, moduleSlug: 'applied-business-analytics', progressPct: 70, inPlan: true, updatedAt: '2026-01-05' },
  { enrollmentId: 2, moduleSlug: 'advanced-machine-learning', progressPct: 65, inPlan: true, updatedAt: '2026-01-05' },
  { enrollmentId: 2, moduleSlug: 'intro-to-deep-learning', progressPct: 60, inPlan: true, updatedAt: '2026-01-05' },
  { enrollmentId: 2, moduleSlug: 'dl-for-computer-vision', progressPct: 55, inPlan: true, updatedAt: '2026-01-05' },
  { enrollmentId: 2, moduleSlug: 'dl-for-nlp', progressPct: 50, inPlan: true, updatedAt: '2026-01-05' },
  { enrollmentId: 2, moduleSlug: 'distributed-ml', progressPct: 40, inPlan: true, updatedAt: '2026-01-05' },
  { enrollmentId: 2, moduleSlug: 'ml-genai-with-microsoft-azure', progressPct: 45, inPlan: true, updatedAt: '2026-01-05' },
  { enrollmentId: 2, moduleSlug: 'productionization-of-ml-systems', progressPct: 30, inPlan: true, updatedAt: '2026-01-05' },
  { enrollmentId: 2, moduleSlug: 'industry-immersion', progressPct: 20, inPlan: true, updatedAt: '2026-01-05' },

  { enrollmentId: 3, moduleSlug: 'intro-to-computer-programming', progressPct: 40, inPlan: true, updatedAt: '2026-01-10' },
  { enrollmentId: 3, moduleSlug: 'numerical-programming-in-python', progressPct: 20, inPlan: true, updatedAt: '2026-01-10' },
  { enrollmentId: 3, moduleSlug: 'relational-databases', progressPct: 0, inPlan: true, updatedAt: '2026-01-10' },
  { enrollmentId: 3, moduleSlug: 'data-visualization-tools', progressPct: 0, inPlan: true, updatedAt: '2026-01-10' },
  { enrollmentId: 3, moduleSlug: 'applied-business-analytics', progressPct: 0, inPlan: true, updatedAt: '2026-01-10' },
  { enrollmentId: 3, moduleSlug: 'advanced-machine-learning', progressPct: 0, inPlan: true, updatedAt: '2026-01-10' },
  { enrollmentId: 3, moduleSlug: 'intro-to-deep-learning', progressPct: 0, inPlan: true, updatedAt: '2026-01-10' },
  { enrollmentId: 3, moduleSlug: 'dl-for-computer-vision', progressPct: 0, inPlan: true, updatedAt: '2026-01-10' },
  { enrollmentId: 3, moduleSlug: 'dl-for-nlp', progressPct: 0, inPlan: true, updatedAt: '2026-01-10' },
  { enrollmentId: 3, moduleSlug: 'distributed-ml', progressPct: 0, inPlan: false, updatedAt: '2026-01-10' },
  { enrollmentId: 3, moduleSlug: 'ml-genai-with-microsoft-azure', progressPct: 0, inPlan: false, updatedAt: '2026-01-10' },
  { enrollmentId: 3, moduleSlug: 'productionization-of-ml-systems', progressPct: 0, inPlan: false, updatedAt: '2026-01-10' },
  { enrollmentId: 3, moduleSlug: 'industry-immersion', progressPct: 0, inPlan: false, updatedAt: '2026-01-10' },
]
