import {
  MOCK_ENROLLMENTS,
  MOCK_MODULE_PROGRESS,
  MOCK_STUDENTS,
  type Enrollment,
  type ModuleProgressRecord,
  type Student,
} from '@spd/shared'
import type { Repositories } from './contracts'

export interface FixtureDataset {
  students?: readonly Student[]
  enrollments?: readonly Enrollment[]
  moduleProgress?: readonly ModuleProgressRecord[]
}

function compareEnrollments(a: Enrollment, b: Enrollment): number {
  if (a.cohortStartDate !== b.cohortStartDate) {
    return a.cohortStartDate < b.cohortStartDate ? 1 : -1
  }
  return b.id - a.id
}

/**
 * In-memory adapter over the shared fictional fixtures. Tests may pass a
 * sanitized, isolated dataset instead of the defaults.
 */
export function createFixtureRepositories(dataset: FixtureDataset = {}): Repositories {
  const students = dataset.students ?? MOCK_STUDENTS
  const enrollments = dataset.enrollments ?? MOCK_ENROLLMENTS
  const moduleProgress = dataset.moduleProgress ?? MOCK_MODULE_PROGRESS

  return {
    students: {
      async getStudentProfile(studentId) {
        const student = students.find((entry) => entry.id === studentId)
        if (!student) return null
        return { id: student.id, name: student.name, email: student.email }
      },
    },
    enrollments: {
      async getCurrentEnrollment(studentId) {
        const matches = enrollments
          .filter((entry) => entry.studentId === studentId)
          .slice()
          .sort(compareEnrollments)
        return matches[0] ?? null
      },
    },
    moduleProgress: {
      async listModuleProgress(enrollmentId) {
        return moduleProgress.filter((entry) => entry.enrollmentId === enrollmentId)
      },
    },
  }
}
