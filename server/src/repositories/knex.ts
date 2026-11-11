import type { Enrollment, ModuleProgressRecord } from '@spd/shared'
import type { Knex } from 'knex'
import { db } from '../db/client'
import type { Repositories } from './contracts'

interface EnrollmentRow {
  id: number
  student_id: number
  cohort: string
  plan_type: string
  sub_plan_type: string | null
  course_type: string
  cohort_start_date: string
  enrolled_at: string
  access_expiry_date: string
  overall_progress_pct: number
  progress_updated_at: string
  import_id: number | null
}

interface ModuleProgressRow {
  moduleSlug: string
  progressPct: number
  inPlan: number | boolean
  updatedAt: string
}

function mapEnrollment(row: EnrollmentRow): Enrollment {
  return {
    id: Number(row.id),
    studentId: Number(row.student_id),
    cohort: row.cohort,
    planType: row.plan_type,
    subPlanType: row.sub_plan_type,
    courseType: row.course_type as Enrollment['courseType'],
    cohortStartDate: row.cohort_start_date,
    enrolledAt: row.enrolled_at,
    accessExpiryDate: row.access_expiry_date,
    overallProgressPct: Number(row.overall_progress_pct),
    progressUpdatedAt: row.progress_updated_at,
    importId: row.import_id === null ? null : Number(row.import_id),
  }
}

/**
 * Read-only adapter over the Phase 0 schema. It does not write, provision
 * accounts, or alter ingestion behavior; those remain Agent 1's ownership.
 */
export function createKnexRepositories(knex: Knex = db): Repositories {
  return {
    students: {
      async getStudentProfile(studentId) {
        const row = await knex('students')
          .where({ id: studentId })
          .first<{ id: number; name: string; email: string } | undefined>(
            'id',
            'name',
            'email',
          )
        if (!row) return null
        return { id: Number(row.id), name: row.name, email: row.email }
      },
    },
    enrollments: {
      async getCurrentEnrollment(studentId) {
        const row = await knex('enrollments')
          .where({ student_id: studentId })
          .orderBy([
            { column: 'cohort_start_date', order: 'desc' },
            { column: 'id', order: 'desc' },
          ])
          .first<EnrollmentRow | undefined>()
        return row ? mapEnrollment(row) : null
      },
    },
    moduleProgress: {
      async listModuleProgress(enrollmentId) {
        const rows = (await knex('module_progress as mp')
          .join('modules as m', 'm.id', 'mp.module_id')
          .where('mp.enrollment_id', enrollmentId)
          .select(
            'm.slug as moduleSlug',
            'mp.progress_pct as progressPct',
            'mp.in_plan as inPlan',
            'mp.updated_at as updatedAt',
          )) as ModuleProgressRow[]

        return rows.map(
          (row): ModuleProgressRecord => ({
            enrollmentId,
            moduleSlug: row.moduleSlug,
            progressPct: Number(row.progressPct),
            inPlan: Boolean(row.inPlan),
            updatedAt: row.updatedAt,
          }),
        )
      },
    },
  }
}
