import type { StudentProfile } from '@spd/shared'
import { firstName } from '../../lib/format'

export function DashboardHeader({ student }: { student: StudentProfile }) {
  return (
    <header className="page-header">
      <p className="eyebrow">Student progress</p>
      <h1>Your Learning Progress</h1>
      <p className="lede">
        Track your course completion, understand your learning pace, and discover where to focus
        next.
      </p>
      <p className="page-header__greeting">Welcome back, {firstName(student.name)}.</p>
    </header>
  )
}
