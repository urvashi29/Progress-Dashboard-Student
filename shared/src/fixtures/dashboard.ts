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

const MOCK_COACH_SUMMARY: CoachSummary = {
  headline: 'Focus on Relational Databases and Data Visualization Tools this week.',
  recommendations: [
    {
      id: 'rec-relational-databases-rescue',
      type: 'RESCUE_MODULE',
      moduleSlug: 'relational-databases',
      title: 'Rescue Relational Databases',
      reason:
        'Progress is 35% while the cohort is past halfway; SQL joins unlock several later modules.',
      priority: 1,
      estimatedMinutes: 180,
      expectedGainPct: 20,
    },
    {
      id: 'rec-data-visualization-quick-win',
      type: 'QUICK_WIN',
      moduleSlug: 'data-visualization-tools',
      title: 'Quick win: Data Visualization Tools',
      reason: 'High catalog weight for a modest time investment before the next deadline.',
      priority: 2,
      estimatedMinutes: 90,
      expectedGainPct: 15,
    },
  ],
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
