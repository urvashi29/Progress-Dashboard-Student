/**
 * Deterministic date helpers for progress health calculations.
 *
 * Source dates are ISO calendar dates (YYYY-MM-DD) and cohort context is IST,
 * so "today" is resolved in a fixed time zone before day arithmetic. All
 * comparisons happen on UTC midnights to avoid DST/offset drift.
 */
export const MS_PER_DAY = 86_400_000

export const DEFAULT_TIME_ZONE = 'Asia/Kolkata'

export interface Clock {
  now(): Date
}

export const systemClock: Clock = {
  now: () => new Date(),
}

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * Parses a strict ISO calendar date. Returns null for missing, malformed, or
 * impossible dates (for example 2026-02-31) so callers can apply an explicit
 * policy instead of throwing or silently inventing a date.
 */
export function parseIsoDate(value: string | null | undefined): Date | null {
  if (typeof value !== 'string') return null
  const match = ISO_DATE_PATTERN.exec(value.trim())
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null
  }

  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }
  return date
}

export function isIsoDate(value: string | null | undefined): value is string {
  return parseIsoDate(value) !== null
}

/** Resolves the calendar date of an instant in the configured time zone. */
export function todayUtcDate(now: Date, timeZone: string = DEFAULT_TIME_ZONE): Date {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now)

    const values = new Map(parts.map((part) => [part.type, part.value]))
    const year = Number(values.get('year'))
    const month = Number(values.get('month'))
    const day = Number(values.get('day'))
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
      throw new Error('Unable to resolve calendar date')
    }
    return new Date(Date.UTC(year, month - 1, day))
  } catch {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  }
}

export function daysBetweenUtcDates(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY)
}

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}
