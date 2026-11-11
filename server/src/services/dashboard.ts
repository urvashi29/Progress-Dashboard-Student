import {
  DashboardResponseSchema,
  MODULES,
  TRACKS,
  moduleProgressBand,
  type CoachSummary,
  type DashboardModule,
  type DashboardResponse,
  type Enrollment,
  type ModuleProgressRecord,
  type StudentProfile,
  type TrackRollup,
} from '@spd/shared'
import { isIsoDate, toIsoDate, todayUtcDate } from '../platform/time'
import { computeHealthAssessment } from './health'

export const PROGRESS_COMPARISON_NOTE =
  'Overall progress is the platform-reported value. Module averages and track rollups are unweighted derived values shown for reference only; they are not the overall progress.'

/**
 * Contract-compatible placeholder. Phase 4 owns recommendations, so this
 * response deliberately contains no invented AI advice.
 */
export const PLACEHOLDER_COACH_SUMMARY: CoachSummary = {
  headline: 'Personalized coach recommendations are not available yet.',
  recommendations: [],
}

export interface DashboardInput {
  student: StudentProfile
  enrollment: Enrollment
  moduleProgress: readonly ModuleProgressRecord[]
  now: Date
  timeZone?: string
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value))
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

function average(values: readonly number[]): number | null {
  if (values.length === 0) return null
  return round1(values.reduce((total, value) => total + value, 0) / values.length)
}

/**
 * Produces all 13 catalog modules in curated catalog order, never M1..M13
 * spreadsheet order. A module with no persisted row is `inPlan: false`; that
 * is distinct from an in-plan module whose real progress is 0%.
 */
export function buildDashboardModules(
  input: Pick<DashboardInput, 'enrollment' | 'moduleProgress' | 'now' | 'timeZone'>,
): DashboardModule[] {
  const fallbackUpdatedAt = isIsoDate(input.enrollment.progressUpdatedAt)
    ? input.enrollment.progressUpdatedAt.trim()
    : toIsoDate(todayUtcDate(input.now, input.timeZone))

  const bySlug = new Map(
    input.moduleProgress.map((record) => [record.moduleSlug, record] as const),
  )

  return MODULES.slice()
    .sort((a, b) => a.catalogOrder - b.catalogOrder)
    .map((catalogModule): DashboardModule => {
      const record = bySlug.get(catalogModule.slug)
      const inPlan = record?.inPlan ?? false
      const progressPct =
        record && Number.isFinite(record.progressPct) ? clampPercent(record.progressPct) : 0
      const updatedAt =
        record && isIsoDate(record.updatedAt)
          ? record.updatedAt.trim()
          : fallbackUpdatedAt

      return {
        moduleSlug: catalogModule.slug,
        progressPct,
        inPlan,
        updatedAt,
        band: moduleProgressBand(progressPct, inPlan),
        name: catalogModule.name,
        track: catalogModule.track,
        catalogOrder: catalogModule.catalogOrder,
        prerequisiteModuleSlugs: catalogModule.prerequisiteModuleSlugs,
      }
    })
}

/**
 * Unweighted mean of in-plan module progress per track. Rollups are derived
 * indicators; they are never presented as the authoritative overall progress.
 */
export function buildTrackRollups(modules: readonly DashboardModule[]): TrackRollup[] {
  return TRACKS.slice()
    .sort((a, b) => a.order - b.order)
    .map((track): TrackRollup => {
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
}

export function buildDashboard(input: DashboardInput): DashboardResponse {
  const modules = buildDashboardModules(input)
  const tracks = buildTrackRollups(modules)
  const inPlanModules = modules.filter((entry) => entry.inPlan)
  const moduleAveragePct = average(inPlanModules.map((entry) => entry.progressPct))

  const health = computeHealthAssessment({
    overallProgressPct: input.enrollment.overallProgressPct,
    cohortStartDate: input.enrollment.cohortStartDate,
    accessExpiryDate: input.enrollment.accessExpiryDate,
    progressUpdatedAt: input.enrollment.progressUpdatedAt,
    now: input.now,
    timeZone: input.timeZone,
  })

  return DashboardResponseSchema.parse({
    student: input.student,
    enrollment: input.enrollment,
    // Authoritative platform value. Never averaged from modules.
    overallProgressPct: input.enrollment.overallProgressPct,
    health,
    tracks,
    modules,
    coachSummary: PLACEHOLDER_COACH_SUMMARY,
    progressComparison: {
      moduleAveragePct,
      differenceFromOverallPct:
        moduleAveragePct === null
          ? null
          : round1(moduleAveragePct - input.enrollment.overallProgressPct),
      note: PROGRESS_COMPARISON_NOTE,
    },
    generatedAt: input.now.toISOString(),
  })
}
