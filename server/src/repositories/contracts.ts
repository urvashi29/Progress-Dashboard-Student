import type { Enrollment, ModuleProgressRecord, StudentProfile } from '@spd/shared'

/**
 * Phase 2 repository boundary.
 *
 * Agent 1 owns persistence/authentication. These narrow read contracts are the
 * integration point: a Knex adapter ships here for the Phase 0 schema, and an
 * in-memory fixture adapter powers deterministic tests. If Agent 1 exposes an
 * equivalent repository, it can be injected into `createApp` without changing
 * any route or calculation code.
 */
export interface StudentReader {
  getStudentProfile(studentId: number): Promise<StudentProfile | null>
}

export interface EnrollmentReader {
  /** Most recent enrollment: latest cohort start, then highest id. */
  getCurrentEnrollment(studentId: number): Promise<Enrollment | null>
}

export interface ModuleProgressReader {
  /**
   * Returns rows that exist for the enrollment. Callers synthesize catalog
   * modules that have no row as `inPlan: false`; absence is never 0% progress.
   */
  listModuleProgress(enrollmentId: number): Promise<ModuleProgressRecord[]>
}

export interface Repositories {
  students: StudentReader
  enrollments: EnrollmentReader
  moduleProgress: ModuleProgressReader
}
