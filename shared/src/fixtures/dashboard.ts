import { TRACKS, getModuleBySlug } from '../catalog'
import type { DashboardResponse, TrackRollup } from '../dashboard'
import { DashboardResponseSchema } from '../dashboard'
import { HealthStatusLabel } from '../health'
import { moduleProgressBand } from '../modules'
import type { CoachSummary } from '../recommendations'
import { getMockEnrollment } from './enrollments'
import { MOCK_MODULE_PROGRESS } from './module-progress'
import { getMockStudent } from './students'

const DASHBOARD_ENROLLMENT_ID = 1

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

function average(values: number[]): number | null {
  if (values.length === 0) return null
  return round1(values.reduce((total, value) => total + value, 0) / values.length)
}

const MOCK_ASSESSMENT_DATA: CoachSummary['assessmentData'] = {
  available: false,
  quizzes: 'unavailable',
  codingQuestions: 'unavailable',
  midCourseAssessments: 'unavailable',
  endCourseAssessments: 'unavailable',
  note: 'Individual quiz, coding-question and assessment results are not available through this dashboard.',
}

const MOCK_COACH_SUMMARY: CoachSummary = {
  headline: 'Finish Numerical Programming in Python, then continue Relational Databases.',
  recommendations: [
    {
      id: 'rec-numerical-programming-near-finish',
      type: 'NEAR_FINISH',
      moduleSlug: 'numerical-programming-in-python',
      moduleName: 'Numerical Programming in Python',
      track: 'foundations',
      title: 'Finish Numerical Programming in Python',
      reason:
        'This module is 80% complete, so finishing the remaining content is the fastest route to completing it.',
      explanation:
        'You are 80% through Numerical Programming in Python. Finish the remaining module content to complete it, and review the key concepts before moving on.',
      priority: 1,
      progressPct: 80,
      inPlan: true,
      action: 'CONTINUE_MODULE',
      skills: [
        { id: 'python-programming', name: 'Python programming', importance: 'critical' },
        { id: 'numerical-methods', name: 'Numerical methods', importance: 'core' },
      ],
      estimatedMinutes: null,
      expectedGainPct: null,
    },
    {
      id: 'rec-relational-databases-continue',
      type: 'CONTINUE_MODULE',
      moduleSlug: 'relational-databases',
      moduleName: 'Relational Databases',
      track: 'foundations',
      title: 'Continue Relational Databases',
      reason:
        'This module is 35% complete and is a prerequisite for later modules in your plan.',
      explanation:
        'Continue the remaining Relational Databases content. It is a prerequisite for Advanced Machine Learning, so completing it also unblocks later work.',
      priority: 2,
      progressPct: 35,
      inPlan: true,
      action: 'CONTINUE_MODULE',
      skills: [
        { id: 'sql-joins', name: 'SQL joins', importance: 'critical' },
        { id: 'schema-design', name: 'Schema design and normalization', importance: 'core' },
      ],
      estimatedMinutes: null,
      expectedGainPct: null,
    },
    {
      id: 'rec-data-visualization-continue',
      type: 'CONTINUE_MODULE',
      moduleSlug: 'data-visualization-tools',
      moduleName: 'Data Visualization Tools',
      track: 'data-analytics',
      title: 'Continue Data Visualization Tools',
      reason: 'This module is 40% complete and is part of your current plan.',
      explanation:
        'Continue the remaining Data Visualization Tools content. The associated skills are best developed by finishing the existing module and using its practice activities for revision.',
      priority: 3,
      progressPct: 40,
      inPlan: true,
      action: 'CONTINUE_MODULE',
      skills: [
        { id: 'chart-selection', name: 'Chart selection', importance: 'critical' },
      ],
      estimatedMinutes: null,
      expectedGainPct: null,
    },
  ],
  generatedBy: 'fallback',
  assessmentData: MOCK_ASSESSMENT_DATA,
  disclaimer:
    'Recommendations use actual module completion data and curriculum mappings. Individual quiz, coding-question and assessment status is unavailable, so no results are claimed.',
  generatedAt: '2026-02-04T09:00:00+05:30',
}

function buildMockDashboard(): DashboardResponse {
  const student = getMockStudent(1)
  const enrollment = getMockEnrollment(DASHBOARD_ENROLLMENT_ID)
  const records = MOCK_MODULE_PROGRESS.filter(
    (record) => record.enrollmentId === DASHBOARD_ENROLLMENT_ID,
  )

  const modules = records
    .map((record) => {
      const catalogModule = getModuleBySlug(record.moduleSlug)
      if (!catalogModule) {
        throw new Error(`Mock progress references unknown module: ${record.moduleSlug}`)
      }
      return {
        moduleSlug: record.moduleSlug,
        progressPct: record.progressPct,
        inPlan: record.inPlan,
        updatedAt: record.updatedAt,
        band: moduleProgressBand(record.progressPct, record.inPlan),
        name: catalogModule.name,
        track: catalogModule.track,
        catalogOrder: catalogModule.catalogOrder,
        prerequisiteModuleSlugs: catalogModule.prerequisiteModuleSlugs,
      }
    })
    .sort((a, b) => a.catalogOrder - b.catalogOrder)

  const tracks: TrackRollup[] = TRACKS.map((track) => {
    const trackModules = modules.filter((entry) => entry.track === track.slug)
    const inPlanModules = trackModules.filter((entry) => entry.inPlan)
    return {
      track: track.slug,
      name: track.name,
      moduleCount: trackModules.length,
      inPlanCount: inPlanModules.length,
      averageProgressPct: average(inPlanModules.map((entry) => entry.progressPct)),
    }
  })

  const moduleAveragePct = average(
    modules.filter((entry) => entry.inPlan).map((entry) => entry.progressPct),
  )

  return DashboardResponseSchema.parse({
    student: {
      id: student.id,
      name: student.name,
      email: student.email,
    },
    enrollment,
    overallProgressPct: enrollment.overallProgressPct,
    health: {
      status: 'BEHIND',
      label: HealthStatusLabel.BEHIND,
      expectedPct: 71,
      paceRatio: round1(enrollment.overallProgressPct / 71),
      staleDays: 46,
      downgraded: false,
      reasons: [
        '34% overall vs 71% expected for this cohort',
        'Last progress update 46 days ago',
      ],
      computedAt: '2026-02-04T09:00:00+05:30',
    },
    tracks,
    modules,
    coachSummary: MOCK_COACH_SUMMARY,
    progressComparison: {
      moduleAveragePct,
      differenceFromOverallPct:
        moduleAveragePct === null ? null : round1(moduleAveragePct - enrollment.overallProgressPct),
      note: 'Overall progress is the platform-reported value. The module average is shown for reference only and is not the same number.',
    },
    generatedAt: '2026-02-04T09:00:00+05:30',
  })
}

export const MOCK_DASHBOARD: DashboardResponse = buildMockDashboard()
