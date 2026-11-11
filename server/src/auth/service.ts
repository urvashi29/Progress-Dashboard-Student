import { normalizeEmail } from '@spd/shared'
import { db } from '../db/client'
import type { AuthRole } from './types'

export type LoginStudentRow = {
  id: number
  name: string
  email: string
  password_hash: string | null
  role: AuthRole
  must_change_password: boolean | number
}

type EnrollmentRow = {
  id: number
  cohort: string
  plan_type: string
  sub_plan_type: string | null
  course_type: string
  cohort_start_date: string
  enrolled_at: string
  access_expiry_date: string
  overall_progress_pct: number | null
  progress_updated_at: string
}

export type StudentEnrollmentSummary = {
  id: number
  cohort: string
  planType: string
  subPlanType: string | null
  courseType: string
  cohortStartDate: string
  enrolledAt: string
  accessExpiryDate: string
  overallProgressPct: number | null
  progressUpdatedAt: string
}

export async function findStudentByEmail(email: string): Promise<LoginStudentRow | undefined> {
  return db('students')
    .where({ email: normalizeEmail(email) })
    .first<LoginStudentRow>(
      'id',
      'name',
      'email',
      'password_hash',
      'role',
      'must_change_password',
    )
}

export async function listEnrollmentsForStudent(
  studentId: number,
): Promise<StudentEnrollmentSummary[]> {
  const rows = await db('enrollments')
    .where({ student_id: studentId })
    .orderBy('cohort_start_date', 'desc')
    .select<EnrollmentRow[]>(
      'id',
      'cohort',
      'plan_type',
      'sub_plan_type',
      'course_type',
      'cohort_start_date',
      'enrolled_at',
      'access_expiry_date',
      'overall_progress_pct',
      'progress_updated_at',
    )

  return rows.map((row) => ({
    id: row.id,
    cohort: row.cohort,
    planType: row.plan_type,
    subPlanType: row.sub_plan_type,
    courseType: row.course_type,
    cohortStartDate: row.cohort_start_date,
    enrolledAt: row.enrolled_at,
    accessExpiryDate: row.access_expiry_date,
    overallProgressPct: row.overall_progress_pct,
    progressUpdatedAt: row.progress_updated_at,
  }))
}

export async function buildAuthPayload(
  student: Pick<LoginStudentRow, 'id' | 'name' | 'email' | 'must_change_password'>,
  csrfToken: string,
): Promise<{
  student: { id: number; name: string; email: string; mustChangePassword: boolean }
  enrollments: StudentEnrollmentSummary[]
  csrfToken: string
}> {
  const enrollments = await listEnrollmentsForStudent(student.id)
  return {
    student: {
      id: student.id,
      name: student.name,
      email: student.email,
      mustChangePassword: Boolean(student.must_change_password),
    },
    enrollments,
    csrfToken,
  }
}
