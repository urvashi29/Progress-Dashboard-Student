import { HealthAssessmentSchema } from '@spd/shared'
import { describe, expect, it } from 'vitest'
import { computeHealthAssessment, type HealthInput } from '../src/services/health'

const NOW = new Date('2026-02-04T09:00:00+05:30')

function assess(overrides: Partial<HealthInput> = {}) {
  const assessment = computeHealthAssessment({
    overallProgressPct: 34,
    cohortStartDate: '2025-08-01',
    accessExpiryDate: '2026-05-01',
    progressUpdatedAt: '2026-02-01',
    now: NOW,
    timeZone: 'Asia/Kolkata',
    ...overrides,
  })
  expect(() => HealthAssessmentSchema.parse(assessment)).not.toThrow()
  return assessment
}

/** Expired window yields exactly 100% expected, isolating pace thresholds. */
const EXPIRED_WINDOW = {
  cohortStartDate: '2025-01-01',
  accessExpiryDate: '2025-01-02',
  progressUpdatedAt: '2026-02-04',
} as const

describe('expected progress calculation', () => {
  it('computes expected progress from cohort start and access expiry', () => {
    const health = assess()
    expect(health.expectedPct).toBe(68.5)
    expect(health.paceRatio).toBe(0.496)
    expect(health.staleDays).toBe(3)
    expect(health.status).toBe('BEHIND')
    expect(health.downgraded).toBe(false)
  })

  it('keeps expected progress at 0 when the cohort begins today', () => {
    const health = assess({ cohortStartDate: '2026-02-04' })
    expect(health.expectedPct).toBe(0)
    expect(health.paceRatio).toBeNull()
    expect(health.status).toBe('GETTING_STARTED')
  })

  it('keeps expected progress at 0 for a future cohort start', () => {
    const health = assess({ cohortStartDate: '2026-03-01' })
    expect(health.expectedPct).toBe(0)
    expect(health.status).toBe('GETTING_STARTED')
  })

  it('caps expected progress at 100 after access expires', () => {
    const health = assess({
      overallProgressPct: 34,
      cohortStartDate: '2025-01-01',
      accessExpiryDate: '2025-06-01',
      progressUpdatedAt: '2026-02-01',
    })
    expect(health.expectedPct).toBe(100)
    expect(health.paceRatio).toBe(0.34)
    expect(health.status).toBe('CRITICAL')
    expect(health.reasons.join(' ')).toContain('expired on 2025-06-01')
  })

  it('handles missing and invalid dates without inventing a timeline', () => {
    const health = assess({ cohortStartDate: 'not-a-date', accessExpiryDate: '' })
    expect(health.expectedPct).toBe(0)
    expect(health.paceRatio).toBeNull()
    expect(health.status).toBe('GETTING_STARTED')
    expect(health.reasons.join(' ')).toContain('timeline is unavailable')
  })

  it('handles an inverted enrollment range', () => {
    const health = assess({ cohortStartDate: '2026-01-01', accessExpiryDate: '2025-01-01' })
    expect(health.expectedPct).toBe(0)
    expect(health.status).toBe('GETTING_STARTED')
    expect(health.reasons.join(' ')).toContain('timeline is unavailable')
  })

  it('handles a zero-duration enrollment deliberately', () => {
    const today = assess({ cohortStartDate: '2026-02-04', accessExpiryDate: '2026-02-04' })
    expect(today.expectedPct).toBe(100)

    const future = assess({ cohortStartDate: '2026-03-01', accessExpiryDate: '2026-03-01' })
    expect(future.expectedPct).toBe(0)
    expect(future.status).toBe('GETTING_STARTED')

    const past = assess({ cohortStartDate: '2025-01-01', accessExpiryDate: '2025-01-01' })
    expect(past.expectedPct).toBe(100)
    expect(past.reasons.join(' ')).toContain('expired on 2025-01-01')
  })

  it('rejects impossible calendar dates as invalid input', () => {
    const health = assess({ cohortStartDate: '2026-02-31', accessExpiryDate: '2026-05-01' })
    expect(health.expectedPct).toBe(0)
    expect(health.status).toBe('GETTING_STARTED')
  })

  it('resolves today in the cohort time zone', () => {
    // 2026-02-03T20:30Z is already 2026-02-04 in Asia/Kolkata.
    const health = assess({
      now: new Date('2026-02-03T20:30:00Z'),
      progressUpdatedAt: '2026-02-03',
    })
    expect(health.staleDays).toBe(1)
  })
})

describe('pace ratio and health boundaries', () => {
  it.each([
    [90, 'ON_TRACK', 0.9],
    [89, 'SLIGHTLY_BEHIND', 0.89],
    [70, 'SLIGHTLY_BEHIND', 0.7],
    [69, 'BEHIND', 0.69],
    [40, 'BEHIND', 0.4],
    [39, 'CRITICAL', 0.39],
  ] as const)(
    'classifies overall %i%% as %s at the pace boundary',
    (overall, status, pace) => {
      const health = assess({ ...EXPIRED_WINDOW, overallProgressPct: overall })
      expect(health.expectedPct).toBe(100)
      expect(health.paceRatio).toBe(pace)
      expect(health.status).toBe(status)
    },
  )

  it('marks Getting Started before 10% expected while still computing pace above 5%', () => {
    const health = assess({ cohortStartDate: '2026-01-30', progressUpdatedAt: '2026-02-04' })
    expect(health.expectedPct).toBeGreaterThan(5)
    expect(health.expectedPct).toBeLessThan(10)
    expect(health.paceRatio).not.toBeNull()
    expect(health.status).toBe('GETTING_STARTED')
  })

  it('returns a null pace ratio when expected progress is 5% or less', () => {
    const health = assess({ cohortStartDate: '2026-02-02', progressUpdatedAt: '2026-02-04' })
    expect(health.expectedPct).toBeLessThanOrEqual(5)
    expect(health.paceRatio).toBeNull()
  })
})

describe('staleness policy', () => {
  it('downgrades exactly one level after more than 30 stale days', () => {
    const health = assess({
      ...EXPIRED_WINDOW,
      overallProgressPct: 90,
      progressUpdatedAt: '2025-12-20',
    })
    expect(health.staleDays).toBe(46)
    expect(health.status).toBe('SLIGHTLY_BEHIND')
    expect(health.downgraded).toBe(true)
    expect(health.reasons.join(' ')).toContain('downgraded one level')
  })

  it('does not compound the 46-day downgrade with the 14-day recency rule', () => {
    const health = assess({
      ...EXPIRED_WINDOW,
      overallProgressPct: 90,
      progressUpdatedAt: '2025-12-20',
    })
    expect(health.status).not.toBe('BEHIND')
  })

  it('allows On Track at exactly 14 stale days', () => {
    const health = assess({
      ...EXPIRED_WINDOW,
      overallProgressPct: 90,
      progressUpdatedAt: '2026-01-21',
    })
    expect(health.staleDays).toBe(14)
    expect(health.status).toBe('ON_TRACK')
    expect(health.downgraded).toBe(false)
  })

  it('downgrades On Track at 15 stale days because On Track requires a recent update', () => {
    const health = assess({
      ...EXPIRED_WINDOW,
      overallProgressPct: 90,
      progressUpdatedAt: '2026-01-20',
    })
    expect(health.staleDays).toBe(15)
    expect(health.status).toBe('SLIGHTLY_BEHIND')
    expect(health.downgraded).toBe(true)
  })

  it('does not downgrade at exactly 30 stale days', () => {
    const health = assess({
      ...EXPIRED_WINDOW,
      overallProgressPct: 69,
      progressUpdatedAt: '2026-01-05',
    })
    expect(health.staleDays).toBe(30)
    expect(health.status).toBe('BEHIND')
    expect(health.downgraded).toBe(false)
  })

  it('handles a missing progress update timestamp explicitly', () => {
    const health = assess({
      ...EXPIRED_WINDOW,
      overallProgressPct: 90,
      progressUpdatedAt: '',
    })
    expect(health.staleDays).toBe(0)
    expect(health.status).toBe('SLIGHTLY_BEHIND')
    expect(health.downgraded).toBe(true)
    expect(health.reasons.join(' ')).toContain('last progress update date is unavailable')
    expect(health.reasons.join(' ')).toContain('status was adjusted')
  })

  it('clamps a future progress update date to zero stale days', () => {
    const health = assess({
      ...EXPIRED_WINDOW,
      overallProgressPct: 90,
      progressUpdatedAt: '2026-06-01',
    })
    expect(health.staleDays).toBe(0)
    expect(health.status).toBe('ON_TRACK')
  })
})

describe('completed students', () => {
  it('stays On Track even when the last update is stale', () => {
    const health = assess({
      overallProgressPct: 100,
      progressUpdatedAt: '2025-01-01',
    })
    expect(health.status).toBe('ON_TRACK')
    expect(health.downgraded).toBe(false)
    expect(health.reasons.join(' ')).toContain('Progress is complete at 100%')
  })
})

describe('reason copy', () => {
  it('explains status in plain language and marks expected progress as an estimate', () => {
    const health = assess({
      overallProgressPct: 34,
      progressUpdatedAt: '2025-12-20',
    })
    expect(health.reasons[0]).toContain('34% overall progress')
    expect(health.reasons[0]).toContain('68.5% expected progress')
    expect(health.reasons[0]).toContain('46 days ago')
    expect(health.reasons.join(' ')).toContain('not a measurement of learning ability')
  })
})
