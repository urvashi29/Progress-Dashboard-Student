import { MODULES, MOCK_ENROLLMENTS, MOCK_MODULE_PROGRESS, MOCK_STUDENTS } from '@spd/shared'
import { db } from './client'
import { seedCatalog } from './seed-catalog'

async function seedMockStudents(): Promise<Map<number, number>> {
  for (const student of MOCK_STUDENTS) {
    await db('students')
      .insert({
        name: student.name,
        email: student.email.toLowerCase(),
        password_hash: null,
        must_change_password: student.mustChangePassword,
        created_at: student.createdAt,
      })
      .onConflict('email')
      .merge(['name', 'must_change_password'])
  }

  const idByFixtureId = new Map<number, number>()
  for (const student of MOCK_STUDENTS) {
    const row = await db('students')
      .where({ email: student.email.toLowerCase() })
      .first<{ id: number } | undefined>('id')
    if (!row) throw new Error(`Seeded student missing after insert: ${student.email}`)
    idByFixtureId.set(student.id, row.id)
  }
  return idByFixtureId
}

async function seedMockEnrollments(studentIdByFixtureId: Map<number, number>): Promise<Map<number, number>> {
  const idByFixtureId = new Map<number, number>()

  for (const enrollment of MOCK_ENROLLMENTS) {
    const studentId = studentIdByFixtureId.get(enrollment.studentId)
    if (!studentId) throw new Error(`Unknown fixture student: ${enrollment.studentId}`)

    await db('enrollments')
      .insert({
        student_id: studentId,
        cohort: enrollment.cohort,
        plan_type: enrollment.planType,
        sub_plan_type: enrollment.subPlanType,
        course_type: enrollment.courseType,
        cohort_start_date: enrollment.cohortStartDate,
        enrolled_at: enrollment.enrolledAt,
        access_expiry_date: enrollment.accessExpiryDate,
        overall_progress_pct: enrollment.overallProgressPct,
        progress_updated_at: enrollment.progressUpdatedAt,
        import_id: enrollment.importId,
      })
      .onConflict(['student_id', 'cohort'])
      .merge([
        'plan_type',
        'sub_plan_type',
        'course_type',
        'cohort_start_date',
        'enrolled_at',
        'access_expiry_date',
        'overall_progress_pct',
        'progress_updated_at',
      ])

    const row = await db('enrollments')
      .where({ student_id: studentId, cohort: enrollment.cohort })
      .first<{ id: number } | undefined>('id')
    if (!row) throw new Error(`Seeded enrollment missing: ${enrollment.cohort}`)
    idByFixtureId.set(enrollment.id, row.id)
  }

  return idByFixtureId
}

async function seedModuleProgress(
  enrollmentIdByFixtureId: Map<number, number>,
  moduleIdBySlug: Map<string, number>,
): Promise<void> {
  for (const record of MOCK_MODULE_PROGRESS) {
    const enrollmentId = enrollmentIdByFixtureId.get(record.enrollmentId)
    const moduleId = moduleIdBySlug.get(record.moduleSlug)
    if (!enrollmentId) throw new Error(`Unknown fixture enrollment: ${record.enrollmentId}`)
    if (!moduleId) throw new Error(`Unknown fixture module: ${record.moduleSlug}`)

    await db('module_progress')
      .insert({
        enrollment_id: enrollmentId,
        module_id: moduleId,
        progress_pct: record.progressPct,
        in_plan: record.inPlan,
        updated_at: record.updatedAt,
      })
      .onConflict(['enrollment_id', 'module_id'])
      .merge(['progress_pct', 'in_plan', 'updated_at'])
  }
}

export async function seedDemoData(): Promise<void> {
  const moduleIdBySlug = await seedCatalog()
  const studentIdByFixtureId = await seedMockStudents()
  const enrollmentIdByFixtureId = await seedMockEnrollments(studentIdByFixtureId)
  await seedModuleProgress(enrollmentIdByFixtureId, moduleIdBySlug)

  console.log(
    `[db] Seeded ${MODULES.length} modules, ${MOCK_STUDENTS.length} fictional students, ` +
      `${MOCK_ENROLLMENTS.length} enrollments, ${MOCK_MODULE_PROGRESS.length} module progress rows`,
  )
  console.log('[db] Seeded fixtures have no passwords; Excel import provisions accounts.')
}

if (typeof require !== 'undefined' && require.main === module) {
  void seedDemoData()
    .catch((error: unknown) => {
      console.error('[db] Seed failed', error)
      process.exitCode = 1
    })
    .finally(() => {
      void db.destroy()
    })
}
