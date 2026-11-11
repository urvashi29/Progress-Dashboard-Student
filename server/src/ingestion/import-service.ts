import { createHash } from 'node:crypto'
import path from 'node:path'
import { findModuleByName, MODULES, normalizeEmail } from '@spd/shared'
import { env } from '../config/env'
import { db } from '../db/client'
import { hashPassword, generateTemporaryPassword } from '../auth/passwords'
import { HttpError } from '../http/errors'
import { appendCredentials, archiveImportFile, type ProvisionedCredential } from './credentials'
import { parseWorkbook } from './excel'
import {
  cleanText,
  isBlank,
  maskEmail,
  MODULE_HEADERS,
  normalizeEmailCell,
  parseBoundedPercent,
  toIsoDate,
} from './normalize'
import type {
  DuplicateEmailWarning,
  ImportReport,
  ImportWarning,
  SkippedRow,
  UnknownModuleWarning,
  ValidationFailure,
} from './types'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type PreparedRow = {
  row: number
  email: string
  name: string
  cohort: string
  planType: string
  subPlanType: string | null
  cohortStartDate: string
  enrolledAt: string
  accessExpiryDate: string
  overallProgressPct: number | null
  progressUpdatedAt: string
  studentCreatedAt: string
  moduleProgress: Map<string, number>
}

type ExistingStudent = {
  id: number
  email: string
  password_hash: string | null
  role: 'student' | 'admin'
}

type Provisioned = ProvisionedCredential & { hash: string }

function isAdminEmail(email: string): boolean {
  return Boolean(env.ADMIN_EMAIL && normalizeEmail(env.ADMIN_EMAIL) === email)
}

function tooLong(value: string, max: number): boolean {
  return value.length > max
}

async function buildProvisioning(rows: PreparedRow[]): Promise<Map<string, Provisioned>> {
  const emails = [...new Set(rows.map((row) => row.email))]
  const existing =
    emails.length === 0
      ? []
      : await db('students')
          .whereIn('email', emails)
          .select<ExistingStudent[]>('id', 'email', 'password_hash', 'role')

  const existingEmails = new Set(
    existing.filter((student) => Boolean(student.password_hash)).map((student) => student.email),
  )
  const queue = emails.filter((email) => !existingEmails.has(email))
  const provisioning = new Map<string, Provisioned>()

  // Hash with bounded concurrency: bcrypt is deliberately expensive, and imports
  // can provision many demo accounts at once. A shared demo password is hashed
  // once and reused; random per-account passwords are hashed individually.
  const demoPassword = env.DEMO_DEFAULT_PASSWORD
  let demoHashPromise: Promise<string> | undefined

  const workers = Array.from({ length: Math.min(4, queue.length) }, async () => {
    for (;;) {
      const email = queue.shift()
      if (!email) return
      const password = demoPassword ?? generateTemporaryPassword()
      const hash = demoPassword
        ? await (demoHashPromise ??= hashPassword(demoPassword))
        : await hashPassword(password)
      provisioning.set(email, { email, password, hash })
    }
  })
  await Promise.all(workers)
  return provisioning
}

function summarizeSkipped(rows: SkippedRow[]): Partial<Record<SkippedRow['reason'], number>> {
  const summary: Partial<Record<SkippedRow['reason'], number>> = {}
  for (const row of rows) {
    summary[row.reason] = (summary[row.reason] ?? 0) + 1
  }
  return summary
}

function parseReport(raw: string): ImportReport {
  return JSON.parse(raw) as ImportReport
}

/**
 * Imports one workbook. Validation and report generation happen before and
 * around a single database transaction; a failed import leaves no partial rows.
 */
export async function importWorkbook(
  buffer: Buffer,
  originalFilename: string,
): Promise<ImportReport> {
  const filename = path.basename(originalFilename).slice(0, 260)
  const fileHash = createHash('sha256').update(buffer).digest('hex')

  const previous = await db('imports').where({ file_hash: fileHash }).first<{ report_json: string }>()
  if (previous) {
    return { ...parseReport(previous.report_json), alreadyImported: true }
  }

  const parsed = await parseWorkbook(buffer)
  const importedAt = new Date().toISOString()

  const warnings: ImportWarning[] = []
  const validationFailures: ValidationFailure[] = []
  const skippedRows: SkippedRow[] = []
  const unknownModules: UnknownModuleWarning[] = []

  for (const header of parsed.unexpectedHeaders) {
    warnings.push({
      code: 'unexpected_header',
      message: `Unexpected column "${header}" was preserved in the report but not imported.`,
      field: header,
    })
  }

  // Duplicate identities are detected across the whole sheet, before course
  // filtering, so a Web3 row sharing a DS email is still reported.
  const rowsByEmail = new Map<string, number[]>()
  for (const row of parsed.rows) {
    if (row.allBlank) continue
    const email = normalizeEmailCell(row.values.get('user_email_id'))
    if (!email) continue
    const list = rowsByEmail.get(email) ?? []
    list.push(row.row)
    rowsByEmail.set(email, list)
  }

  const duplicateEmails: DuplicateEmailWarning[] = []
  for (const [email, rows] of rowsByEmail) {
    if (rows.length < 2) continue
    duplicateEmails.push({ emailMasked: maskEmail(email), rows })
    warnings.push({
      code: 'duplicate_email',
      message: `Email ${maskEmail(email)} appears on rows ${rows.join(', ')}. One account is kept; enrollments remain keyed by (student, cohort).`,
    })
  }
  duplicateEmails.sort((a, b) => (a.rows[0] ?? 0) - (b.rows[0] ?? 0))

  const preparedRows: PreparedRow[] = []

  for (const row of parsed.rows) {
    const get = (header: string): unknown => row.values.get(header)

    if (row.allBlank) {
      skippedRows.push({ row: row.row, reason: 'empty_row' })
      continue
    }

    const courseType = cleanText(get('course_type')).toLowerCase()
    if (!courseType) {
      validationFailures.push({
        row: row.row,
        field: 'course_type',
        message: 'Missing required course type',
      })
      skippedRows.push({ row: row.row, reason: 'validation_failed' })
      continue
    }

    if (courseType !== 'data-science') {
      skippedRows.push({
        row: row.row,
        reason: 'non_data_science',
        detail: courseType.slice(0, 40),
      })
      continue
    }

    const email = normalizeEmailCell(get('user_email_id'))
    if (!email || !EMAIL_PATTERN.test(email) || tooLong(email, 320)) {
      validationFailures.push({
        row: row.row,
        field: 'user_email_id',
        message: 'Missing or invalid email address',
      })
      skippedRows.push({ row: row.row, reason: 'invalid_email' })
      continue
    }

    const name = cleanText(get('user_name'))
    const cohort = cleanText(get('cohort_name'))
    const planType = cleanText(get('plan_type'))
    const subPlanTypeRaw = cleanText(get('sub_plan_type'))
    const subPlanType = subPlanTypeRaw === '' ? null : subPlanTypeRaw
    let rowInvalid = false

    if (!name || tooLong(name, 200)) {
      validationFailures.push({
        row: row.row,
        field: 'user_name',
        message: !name ? 'Missing student name' : 'Student name exceeds 200 characters',
      })
      rowInvalid = true
    }
    if (!cohort || tooLong(cohort, 100)) {
      validationFailures.push({
        row: row.row,
        field: 'cohort_name',
        message: !cohort ? 'Missing cohort name' : 'Cohort name exceeds 100 characters',
      })
      rowInvalid = true
    }
    if (!planType || tooLong(planType, 200)) {
      validationFailures.push({
        row: row.row,
        field: 'plan_type',
        message: !planType ? 'Missing plan type' : 'Plan type exceeds 200 characters',
      })
      rowInvalid = true
    }
    if (subPlanType && tooLong(subPlanType, 200)) {
      validationFailures.push({
        row: row.row,
        field: 'sub_plan_type',
        message: 'Sub-plan type exceeds 200 characters',
      })
      rowInvalid = true
    }

    const requiredDates: Array<[string, string]> = [
      ['cohort_start_date_raw', 'cohort start date'],
      ['enrollment_at_ist', 'enrollment date'],
      ['course_access_expiry_date', 'access expiry date'],
      ['progress_last_updated_at_ist', 'progress update date'],
    ]
    const dates = new Map<string, string>()
    for (const [header, label] of requiredDates) {
      const raw = get(header)
      const iso = toIsoDate(raw)
      if (!iso) {
        validationFailures.push({
          row: row.row,
          field: header,
          message: `Invalid or missing ${label}`,
          rawValue: isBlank(raw) ? undefined : String(raw).slice(0, 40),
        })
        rowInvalid = true
      } else {
        dates.set(header, iso)
      }
    }

    const createdAtIso = toIsoDate(get('user_created_on_ist'))
    if (!createdAtIso && !isBlank(get('user_created_on_ist'))) {
      warnings.push({
        code: 'invalid_optional_date',
        row: row.row,
        field: 'user_created_on_ist',
        message: 'Invalid account creation date; import timestamp is used instead.',
        rawValue: String(get('user_created_on_ist')).slice(0, 40),
      })
    }

    const overallRaw = get('overall_progress_pct')
    const overall = parseBoundedPercent(overallRaw)
    let overallProgressPct: number | null = null
    if (overall.ok) {
      overallProgressPct = overall.value
    } else if (overall.reason === 'missing') {
      warnings.push({
        code: 'missing_overall_progress',
        row: row.row,
        field: 'overall_progress_pct',
        message: 'Platform overall progress is blank; stored as NULL (not reported).',
      })
    } else {
      warnings.push({
        code: 'invalid_overall_progress',
        row: row.row,
        field: 'overall_progress_pct',
        message: `Overall progress is ${overall.reason}; stored as NULL (not reported).`,
        rawValue: overall.raw.slice(0, 40),
      })
    }

    const moduleProgress = new Map<string, number>()
    for (const [nameHeader, progressHeader] of MODULE_HEADERS) {
      const rawName = cleanText(get(nameHeader))
      const progressRaw = get(progressHeader)

      if (!rawName) {
        if (!isBlank(progressRaw)) {
          warnings.push({
            code: 'orphan_module_progress',
            row: row.row,
            field: progressHeader,
            message: 'A module percentage was supplied without a module name; it was ignored.',
            rawValue: String(progressRaw).slice(0, 40),
          })
        }
        continue
      }

      const catalogModule = findModuleByName(rawName)
      if (!catalogModule) {
        warnings.push({
          code: 'unknown_module',
          row: row.row,
          field: nameHeader,
          moduleName: rawName.slice(0, 200),
          message: `Unknown module "${rawName}" was reported and not stored.`,
        })
        unknownModules.push({ row: row.row, moduleName: rawName.slice(0, 200) })
        continue
      }

      const percent = parseBoundedPercent(progressRaw)
      if (!percent.ok) {
        validationFailures.push({
          row: row.row,
          field: progressHeader,
          message:
            percent.reason === 'missing'
              ? `Missing progress for "${catalogModule.name}"`
              : `Progress for "${catalogModule.name}" is ${percent.reason}`,
          rawValue: percent.raw ? percent.raw.slice(0, 40) : undefined,
        })
        rowInvalid = true
        continue
      }

      if (moduleProgress.has(catalogModule.slug)) {
        warnings.push({
          code: 'duplicate_module_in_row',
          row: row.row,
          field: nameHeader,
          moduleName: catalogModule.name,
          message: `Module "${catalogModule.name}" appeared more than once; the last value is kept.`,
        })
      }
      moduleProgress.set(catalogModule.slug, percent.value)
    }

    if (rowInvalid) {
      skippedRows.push({ row: row.row, reason: 'validation_failed' })
      continue
    }

    preparedRows.push({
      row: row.row,
      email,
      name,
      cohort,
      planType,
      subPlanType,
      cohortStartDate: dates.get('cohort_start_date_raw') as string,
      enrolledAt: dates.get('enrollment_at_ist') as string,
      accessExpiryDate: dates.get('course_access_expiry_date') as string,
      overallProgressPct,
      progressUpdatedAt: dates.get('progress_last_updated_at_ist') as string,
      studentCreatedAt: createdAtIso
        ? `${createdAtIso}T00:00:00.000Z`
        : importedAt,
      moduleProgress,
    })
  }

  // Refuse to write progress if the catalog has not been migrated/seeded.
  const moduleRows = await db('modules').select<Array<{ id: number; slug: string }>>(
    'id',
    'slug',
  )
  const moduleIdBySlug = new Map(moduleRows.map((moduleRow) => [moduleRow.slug, moduleRow.id]))
  const missingCatalog = MODULES.filter((module) => !moduleIdBySlug.has(module.slug))
  if (missingCatalog.length > 0) {
    throw new HttpError(500, 'catalog_not_initialized', 'Module catalog is not seeded')
  }

  const provisioning = await buildProvisioning(preparedRows)

  // Store the private workbook only after structural validation passes. The
  // file lives under the gitignored PRIVATE_DATA_DIR.
  try {
    archiveImportFile(buffer, filename, fileHash)
  } catch {
    throw new HttpError(500, 'storage_error', 'Could not archive the uploaded workbook')
  }

  let createdStudents = 0
  let updatedStudents = 0
  let createdEnrollments = 0
  let updatedEnrollments = 0
  let moduleProgressRows = 0
  const usedCredentials: ProvisionedCredential[] = []

  const skippedByReason = summarizeSkipped(skippedRows)

  const report: ImportReport = {
    filename,
    fileHash,
    importedAt,
    rowsTotal: parsed.rowsTotal,
    imported: preparedRows.length,
    createdStudents: 0,
    updatedStudents: 0,
    createdEnrollments: 0,
    updatedEnrollments: 0,
    moduleProgressRows: 0,
    skippedTotal: skippedRows.length,
    skippedByReason,
    skippedRows,
    warnings,
    duplicateEmails,
    unknownModules,
    validationFailures,
    unexpectedHeaders: parsed.unexpectedHeaders,
  }

  try {
    await db.transaction(async (trx) => {
      await trx('imports').insert({
        filename,
        file_hash: fileHash,
        rows_total: parsed.rowsTotal,
        imported: 0,
        skipped: 0,
        report_json: '{}',
        created_at: importedAt,
      })
      const importRow = await trx('imports')
        .where({ file_hash: fileHash })
        .first<{ id: number }>('id')
      if (!importRow) throw new Error('import record was not created')
      const importId = importRow.id

      for (const row of preparedRows) {
        const existingStudent = await trx('students')
          .where({ email: row.email })
          .first<ExistingStudent>('id', 'email', 'password_hash', 'role')

        let studentId: number
        if (!existingStudent) {
          const provisioned = provisioning.get(row.email)
          if (!provisioned) throw new Error('missing password provisioning')
          await trx('students').insert({
            name: row.name,
            email: row.email,
            password_hash: provisioned.hash,
            must_change_password: true,
            role: isAdminEmail(row.email) ? 'admin' : 'student',
            created_at: row.studentCreatedAt,
          })
          const inserted = await trx('students')
            .where({ email: row.email })
            .first<{ id: number }>('id')
          if (!inserted) throw new Error('student insert failed')
          studentId = inserted.id
          createdStudents += 1
          usedCredentials.push({ email: row.email, password: provisioned.password })
        } else {
          studentId = existingStudent.id
          const patch: Record<string, unknown> = { name: row.name }
          if (!existingStudent.password_hash) {
            const provisioned = provisioning.get(row.email)
            if (!provisioned) throw new Error('missing password provisioning')
            patch.password_hash = provisioned.hash
            patch.must_change_password = true
            usedCredentials.push({ email: row.email, password: provisioned.password })
          }
          if (isAdminEmail(row.email) && existingStudent.role !== 'admin') {
            patch.role = 'admin'
          }
          await trx('students').where({ id: studentId }).update(patch)
          updatedStudents += 1
        }

        const existingEnrollment = await trx('enrollments')
          .where({ student_id: studentId, cohort: row.cohort })
          .first<{ id: number }>('id')

        const enrollmentValues = {
          student_id: studentId,
          cohort: row.cohort,
          plan_type: row.planType,
          sub_plan_type: row.subPlanType,
          course_type: 'data-science',
          cohort_start_date: row.cohortStartDate,
          enrolled_at: row.enrolledAt,
          access_expiry_date: row.accessExpiryDate,
          overall_progress_pct: row.overallProgressPct,
          progress_updated_at: row.progressUpdatedAt,
          import_id: importId,
        }

        let enrollmentId: number
        if (existingEnrollment) {
          await trx('enrollments').where({ id: existingEnrollment.id }).update(enrollmentValues)
          enrollmentId = existingEnrollment.id
          updatedEnrollments += 1
        } else {
          await trx('enrollments').insert(enrollmentValues)
          const inserted = await trx('enrollments')
            .where({ student_id: studentId, cohort: row.cohort })
            .first<{ id: number }>('id')
          if (!inserted) throw new Error('enrollment insert failed')
          enrollmentId = inserted.id
          createdEnrollments += 1
        }

        for (const catalogModule of MODULES) {
          const moduleId = moduleIdBySlug.get(catalogModule.slug)
          if (!moduleId) throw new Error('catalog module missing')
          const progress = row.moduleProgress.get(catalogModule.slug)
          const inPlan = progress !== undefined

          await trx('module_progress')
            .insert({
              enrollment_id: enrollmentId,
              module_id: moduleId,
              progress_pct: inPlan ? progress : 0,
              in_plan: inPlan,
              updated_at: row.progressUpdatedAt,
            })
            .onConflict(['enrollment_id', 'module_id'])
            .merge(['progress_pct', 'in_plan', 'updated_at'])
          moduleProgressRows += 1
        }
      }

      report.createdStudents = createdStudents
      report.updatedStudents = updatedStudents
      report.createdEnrollments = createdEnrollments
      report.updatedEnrollments = updatedEnrollments
      report.moduleProgressRows = moduleProgressRows

      await trx('imports').where({ id: importId }).update({
        imported: preparedRows.length,
        skipped: skippedRows.length,
        report_json: JSON.stringify(report),
      })
    })
  } catch (error) {
    // A concurrent import of the same file may win the unique file-hash race.
    const raced = await db('imports')
      .where({ file_hash: fileHash })
      .first<{ report_json: string }>()
    if (raced) return { ...parseReport(raced.report_json), alreadyImported: true }
    throw error
  }

  try {
    appendCredentials(usedCredentials)
  } catch {
    report.warnings.push({
      code: 'credentials_write_failed',
      message:
        'Accounts were created but the local credentials CSV could not be written. Use a password reset/invitation flow.',
    })
    await db('imports').where({ file_hash: fileHash }).update({ report_json: JSON.stringify(report) })
  }

  return report
}
