import ExcelJS from 'exceljs'
import {
  FIXED_HEADERS,
  MODULE_HEADERS,
} from '../../src/ingestion/normalize'

export const HEADERS = [...FIXED_HEADERS, ...MODULE_HEADERS.flat()] as string[]

/** Real spreadsheet labels, all fictional rows below. */
export const DEFAULT_MODULE_NAMES = [
  'Introduction to Computer Programming',
  'Distributed Machine Learning',
  'Productionization of ML Systems',
  'Advanced Machine Learning',
  'Introduction to Deep Learning',
  'Deep Learning for Computer Vision',
  'Deep Learning for NLP',
  'Industry Immersion',
  'Machine Learning & Generative AI with Microsoft Azure',
  'Data Visualization Tools',
  'Applied Business Analytics',
  'Numerical Programming in Python',
  'Relational Databases',
] as const

export const DEFAULT_PROGRESS = [95, 10, 20, 30, 40, 50, 60, 70, 80, 90, 25, 35, 45]

export type FixtureModule = {
  name: string
  progress: number | string | null
}

export type FixtureRow = {
  name?: string
  email?: string
  cohort?: string
  courseType?: string
  planType?: string
  subPlanType?: string | null
  overall?: number | string | null
  cohortStartDate?: number | string | Date | null
  enrolledAt?: number | string | Date | null
  accessExpiryDate?: number | string | Date | null
  progressUpdatedAt?: number | string | Date | null
  userCreatedOn?: number | string | Date | null
  modules?: FixtureModule[]
}

export type FixtureRowInput = FixtureRow | 'EMPTY'

const HEADER_INDEX = new Map(HEADERS.map((header, index) => [header, index]))

const DEFAULT_DATES = {
  cohortStartDate: 45657,
  enrolledAt: 45659,
  accessExpiryDate: 46205,
  progressUpdatedAt: 46094,
  userCreatedOn: 45657,
}

export function defaultModules(): FixtureModule[] {
  return DEFAULT_MODULE_NAMES.map((name, index) => ({
    name,
    progress: DEFAULT_PROGRESS[index] ?? 0,
  }))
}

function buildRowValues(row: FixtureRow): unknown[] {
  const values: unknown[] = new Array(HEADERS.length).fill(null)
  const set = (header: string, value: unknown): void => {
    const index = HEADER_INDEX.get(header)
    if (index === undefined) throw new Error(`Unknown fixture header: ${header}`)
    values[index] = value
  }

  set('user_name', row.name ?? 'Fictional Student')
  set('user_email_id', row.email ?? 'student@example.com')
  set('cohort_name', row.cohort ?? 'Cohort TEST01')
  set('cohort_start_date_raw', row.cohortStartDate ?? DEFAULT_DATES.cohortStartDate)
  set('cohort_start_month', 45627)
  set('almax_cohort_name', null)
  set('plan_type', row.planType ?? 'masters')
  set('user_created_on_ist', row.userCreatedOn ?? DEFAULT_DATES.userCreatedOn)
  set('enrollment_at_ist', row.enrolledAt ?? DEFAULT_DATES.enrolledAt)
  set('course_type', row.courseType ?? 'data-science')
  set('sub_plan_type', row.subPlanType ?? null)
  set('course_access_expiry_date', row.accessExpiryDate ?? DEFAULT_DATES.accessExpiryDate)
  set('overall_progress_pct', row.overall === undefined ? 73 : row.overall)
  set('progress_last_updated_at_ist', row.progressUpdatedAt ?? DEFAULT_DATES.progressUpdatedAt)

  const modules = row.modules ?? defaultModules()
  modules.slice(0, 13).forEach((module, index) => {
    set(`M${index + 1} name`, module.name)
    set(`M${index + 1} progress %`, module.progress)
  })

  return values
}

/** Builds a sanitized .xlsx buffer with fictional identities only. */
export async function buildWorkbook(rows: FixtureRowInput[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Sheet1')
  sheet.addRow(HEADERS)

  for (const row of rows) {
    if (row === 'EMPTY') {
      sheet.addRow([])
      continue
    }
    sheet.addRow(buildRowValues(row))
  }

  const written = await workbook.xlsx.writeBuffer()
  return Buffer.isBuffer(written)
    ? written
    : Buffer.from(written as unknown as ArrayBuffer)
}

/** Fictional identity used by tests; never real student data. */
export function fixtureEmail(index: number): string {
  return `student${String(index).padStart(4, '0')}@example.com`
}

/**
 * Reproduces the workbook audit shape: 173 rows total, 1 empty row, 2 Web3
 * rows, 2 duplicate-email warnings, partial/reordered module lists, and 8
 * blank overall-progress values. All identities are fictional.
 */
export function expectedCountRows(): FixtureRowInput[] {
  const rows: FixtureRowInput[] = []

  for (let index = 0; index < 170; index += 1) {
    let modules = defaultModules()
    if (index === 0) {
      modules = modules.filter((module) => module.name !== 'Industry Immersion')
    }
    if (index === 1) {
      modules = modules.filter(
        (module) =>
          !module.name.includes('Deep Learning') && module.name !== 'Industry Immersion',
      )
    }
    if (index === 2) {
      modules = [...modules].reverse()
    }

    const row: FixtureRow = {
      name: `Fictional Student ${index + 1}`,
      email: fixtureEmail(index + 1),
      cohort: `Cohort TEST${String(index % 5).padStart(2, '0')}`,
      overall: index < 8 ? null : (index * 7) % 101,
      modules,
    }
    rows.push(row)
  }

  // A truly empty row is kept in the middle: ExcelJS trims trailing blank rows
  // that carry no styling, unlike the real export's styled empty row.
  rows.push('EMPTY')
  rows.push({
    name: 'Fictional Web3 Learner One',
    email: fixtureEmail(1),
    cohort: 'Cohort WEB3A',
    courseType: 'web3',
    overall: 0,
  })
  rows.push({
    name: 'Fictional Web3 Learner Two',
    email: fixtureEmail(2),
    cohort: 'Cohort WEB3B',
    courseType: 'web3',
    overall: 10,
  })

  return rows
}
