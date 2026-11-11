import {
  HealthAssessmentSchema,
  HealthStatusLabel,
  type HealthAssessment,
  type HealthStatus,
} from '@spd/shared'
import {
  daysBetweenUtcDates,
  parseIsoDate,
  toIsoDate,
  todayUtcDate,
} from '../platform/time'

export interface HealthInput {
  /** Platform-reported overall progress. This is authoritative. */
  overallProgressPct: number
  cohortStartDate: string | null | undefined
  accessExpiryDate: string | null | undefined
  progressUpdatedAt: string | null | undefined
  /** Injected clock instant so requests and tests are deterministic. */
  now: Date
  timeZone?: string
}

const PACING_MIN_EXPECTED_PCT = 5
const GETTING_STARTED_MAX_EXPECTED_PCT = 10
const ON_TRACK_MIN_PACE_RATIO = 0.9
const SLIGHTLY_BEHIND_MIN_PACE_RATIO = 0.7
const BEHIND_MIN_PACE_RATIO = 0.4
const RECENT_UPDATE_MAX_DAYS = 14
const STALE_DOWNGRADE_DAYS = 30

const STATUS_ORDER: readonly HealthStatus[] = [
  'GETTING_STARTED',
  'ON_TRACK',
  'SLIGHTLY_BEHIND',
  'BEHIND',
  'CRITICAL',
]

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function formatNumber(value: number): string {
  const rounded = roundTo(value, 1)
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

function classifyPace(paceRatio: number | null): HealthStatus {
  if (paceRatio === null) return 'GETTING_STARTED'
  if (paceRatio >= ON_TRACK_MIN_PACE_RATIO) return 'ON_TRACK'
  if (paceRatio >= SLIGHTLY_BEHIND_MIN_PACE_RATIO) return 'SLIGHTLY_BEHIND'
  if (paceRatio >= BEHIND_MIN_PACE_RATIO) return 'BEHIND'
  return 'CRITICAL'
}

/** Downgrades exactly one level; Critical and Getting Started stay put. */
function downgrade(status: HealthStatus): HealthStatus {
  const index = STATUS_ORDER.indexOf(status)
  if (index < 0 || status === 'GETTING_STARTED') return status
  return STATUS_ORDER[Math.min(index + 1, STATUS_ORDER.length - 1)] as HealthStatus
}

function staleSuffix(staleDays: number): string {
  return ` Last progress update was ${staleDays} day${staleDays === 1 ? '' : 's'} ago.`
}

/**
 * Computes the pace-aware health assessment.
 *
 * Policy decisions (documented for review):
 * - Missing/invalid cohort dates or an inverted range -> expected 0%,
 *   Getting Started, pace null, with an explicit reason. We do not guess dates.
 * - Cohort starting in the future -> expected 0%, Getting Started.
 * - Zero-length enrollment -> 0% before the start date, otherwise 100%.
 * - Expired access -> expected is capped at 100%; the expiry is explained.
 * - expectedPct is rounded to one decimal before the pace ratio is derived.
 * - On Track requires a pace ratio >= 0.9 and a verified update within 14 days.
 *   A 15-30 day old update downgrades a pace-based On Track to Slightly Behind,
 *   and a missing update date likewise prevents On Track (recency is unverified).
 * - More than 30 stale days downgrades the pace-based status exactly one level,
 *   and is not compounded with the 14-day recency rule.
 * - A completed student (platform overall 100%) is On Track regardless of
 *   staleness or cohort age, because there is no remaining schedule target.
 * - Missing progress-update dates use staleDays 0 (cannot assess) and say so;
 *   future progress-update dates also clamp to 0 stale days.
 */
export function computeHealthAssessment(input: HealthInput): HealthAssessment {
  const overall = Number.isFinite(input.overallProgressPct)
    ? clamp(input.overallProgressPct, 0, 100)
    : 0

  const today = todayUtcDate(input.now, input.timeZone)
  const start = parseIsoDate(input.cohortStartDate)
  const expiry = parseIsoDate(input.accessExpiryDate)
  const updated = parseIsoDate(input.progressUpdatedAt)
  const hasUpdateDate = updated !== null

  const staleDays = updated ? Math.max(0, daysBetweenUtcDates(updated, today)) : 0

  let expectedPct = 0
  let timelineInvalid = start === null || expiry === null
  let expired = false

  if (!timelineInvalid && start !== null && expiry !== null) {
    const durationDays = daysBetweenUtcDates(start, expiry)
    if (durationDays < 0) {
      timelineInvalid = true
    } else if (durationDays === 0) {
      expectedPct = today.getTime() < start.getTime() ? 0 : 100
      expired = today.getTime() > expiry.getTime()
    } else {
      const elapsedDays = daysBetweenUtcDates(start, today)
      expectedPct = clamp((elapsedDays / durationDays) * 100, 0, 100)
      expired = today.getTime() > expiry.getTime()
    }
  }

  expectedPct = roundTo(expectedPct, 1)
  const paceRatio =
    expectedPct > PACING_MIN_EXPECTED_PCT ? roundTo(overall / expectedPct, 3) : null

  const completed = overall >= 100
  let status: HealthStatus
  let downgraded = false

  if (completed) {
    status = 'ON_TRACK'
  } else if (timelineInvalid || expectedPct < GETTING_STARTED_MAX_EXPECTED_PCT) {
    status = 'GETTING_STARTED'
  } else {
    const paceStatus = classifyPace(paceRatio)
    status = paceStatus

    if (staleDays > STALE_DOWNGRADE_DAYS) {
      status = downgrade(paceStatus)
      downgraded = status !== paceStatus
    } else if (
      (!hasUpdateDate || staleDays > RECENT_UPDATE_MAX_DAYS) &&
      paceStatus === 'ON_TRACK'
    ) {
      status = 'SLIGHTLY_BEHIND'
      downgraded = true
    }
  }

  const reasons: string[] = []
  const updateSuffix = hasUpdateDate ? staleSuffix(staleDays) : ''

  if (completed) {
    reasons.push(
      `Progress is complete at ${formatNumber(overall)}% overall, so there is no remaining schedule target for this cohort.`,
    )
  } else if (timelineInvalid) {
    reasons.push(
      'The cohort timeline is unavailable because the enrollment start date or access-expiry date is missing or invalid.',
    )
    reasons.push(`Overall progress is ${formatNumber(overall)}% (platform-reported).`)
  } else if (expectedPct < GETTING_STARTED_MAX_EXPECTED_PCT) {
    reasons.push(
      `${HealthStatusLabel[status]} — the cohort is ${formatNumber(expectedPct)}% into its schedule, so expected progress is below 10%.${updateSuffix}`,
    )
    reasons.push(`Overall progress is ${formatNumber(overall)}% (platform-reported).`)
  } else {
    reasons.push(
      `${HealthStatusLabel[status]} — ${formatNumber(overall)}% overall progress compared with ${formatNumber(expectedPct)}% expected progress for this cohort.${updateSuffix}`,
    )
  }

  if (!hasUpdateDate) {
    reasons.push(
      'The last progress update date is unavailable, so staleness could not be assessed.',
    )
  }

  if (expired && expiry !== null) {
    reasons.push(
      `Course access expired on ${toIsoDate(expiry)}; expected progress is capped at 100%.`,
    )
  }

  if (downgraded && staleDays > STALE_DOWNGRADE_DAYS) {
    reasons.push(
      `The status was downgraded one level because progress was last updated ${staleDays} days ago (more than 30 days).`,
    )
  } else if (downgraded && !hasUpdateDate) {
    reasons.push(
      'On Track requires a recent progress update, but the last update date is unavailable, so the status was adjusted.',
    )
  } else if (downgraded && staleDays > RECENT_UPDATE_MAX_DAYS) {
    reasons.push(
      'On Track requires progress updated within the last 14 days, so the status was adjusted.',
    )
  }

  reasons.push(
    'Expected progress is a schedule-based estimate, not a measurement of learning ability.',
  )

  return HealthAssessmentSchema.parse({
    status,
    label: HealthStatusLabel[status],
    expectedPct,
    paceRatio,
    staleDays,
    downgraded,
    reasons,
    computedAt: input.now.toISOString(),
  })
}
