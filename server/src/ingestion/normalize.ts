/**
 * Ingestion normalization rules. Kept free of database/Express code so they can
 * be unit-tested directly and reused by report generation.
 */

export const FIXED_HEADERS = [
  'user_name',
  'user_email_id',
  'cohort_name',
  'cohort_start_date_raw',
  'cohort_start_month',
  'almax_cohort_name',
  'plan_type',
  'user_created_on_ist',
  'enrollment_at_ist',
  'course_type',
  'sub_plan_type',
  'course_access_expiry_date',
  'overall_progress_pct',
  'progress_last_updated_at_ist',
] as const

export const MODULE_SLOT_COUNT = 13

export const MODULE_HEADERS = Array.from({ length: MODULE_SLOT_COUNT }, (_, index) => {
  const n = index + 1
  return [`M${n} name`, `M${n} progress %`] as const
})

export const REQUIRED_HEADERS = [
  ...FIXED_HEADERS,
  ...MODULE_HEADERS.flat(),
] as const

/** Excel's 1900 date system, with the usual 1899-12-30 epoch correction. */
const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30)
const MIN_YEAR = 1900
const MAX_YEAR = 2100

export function isBlank(value: unknown): boolean {
  return value === null || value === undefined || String(value).trim() === ''
}

export function cleanText(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

export function normalizeHeader(value: unknown): string {
  return cleanText(value).toLowerCase()
}

function isValidIsoDate(year: number, month: number, day: number): boolean {
  if (year < MIN_YEAR || year > MAX_YEAR) return false
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

/**
 * Converts Excel serial dates, JS Date values (ExcelJS date-formatted cells),
 * and ISO strings into `YYYY-MM-DD`. Returns undefined for anything invalid so
 * callers can report a validation failure instead of storing a guess.
 */
export function toIsoDate(value: unknown): string | undefined {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return undefined
    const year = value.getUTCFullYear()
    if (year < MIN_YEAR || year > MAX_YEAR) return undefined
    return value.toISOString().slice(0, 10)
  }

  if (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) {
    const text = String(value).trim()

    const isoMatch = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/.exec(text)
    if (isoMatch) {
      const year = Number(isoMatch[1])
      const month = Number(isoMatch[2])
      const day = Number(isoMatch[3])
      return isValidIsoDate(year, month, day) ? text.slice(0, 10) : undefined
    }

    if (!/^-?\d+(?:\.\d+)?$/.test(text)) return undefined
    const serial = Number(text)
    if (!Number.isFinite(serial) || serial <= 0) return undefined

    const date = new Date(EXCEL_EPOCH_UTC + Math.round(serial) * 86_400_000)
    if (Number.isNaN(date.getTime())) return undefined
    const year = date.getUTCFullYear()
    if (year < MIN_YEAR || year > MAX_YEAR) return undefined
    return date.toISOString().slice(0, 10)
  }

  return undefined
}

export type NumericParseResult =
  | { ok: true; value: number }
  | { ok: false; reason: 'missing' | 'not_numeric' | 'out_of_range'; raw: string }

export function parseBoundedPercent(value: unknown): NumericParseResult {
  if (isBlank(value)) return { ok: false, reason: 'missing', raw: '' }

  const raw = String(value).trim()
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return { ok: false, reason: 'not_numeric', raw }
  if (parsed < 0 || parsed > 100) return { ok: false, reason: 'out_of_range', raw }
  return { ok: true, value: parsed }
}

/** Reports duplicate identities without exposing the full address. */
export function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@')
  const visible = local.slice(0, 1) || '*'
  return `${visible}***@${domain || 'unknown'}`
}

export function normalizeEmailCell(value: unknown): string {
  return cleanText(value).toLowerCase()
}

export function toIdList(values: number[]): string {
  return values.join(', ')
}
