import type { Student } from '../students'

/**
 * Fictional identities only. Emails use the reserved example.com domain.
 * No real spreadsheet rows, names, or addresses may enter fixtures.
 */
export const MOCK_STUDENTS: Student[] = [
  {
    id: 1,
    name: 'Aanya Fictional',
    email: 'aanya.fictional@example.com',
    mustChangePassword: true,
    createdAt: '2025-07-15T09:00:00+05:30',
  },
  {
    id: 2,
    name: 'Bhavya Sample',
    email: 'bhavya.sample@example.com',
    mustChangePassword: true,
    createdAt: '2025-07-15T09:05:00+05:30',
  },
  {
    id: 3,
    name: 'Chirag Placeholder',
    email: 'chirag.placeholder@example.com',
    mustChangePassword: true,
    createdAt: '2025-11-20T11:30:00+05:30',
  },
]

export function getMockStudent(id: number): Student {
  const student = MOCK_STUDENTS.find((entry) => entry.id === id)
  if (!student) throw new Error(`Unknown mock student id: ${id}`)
  return student
}
