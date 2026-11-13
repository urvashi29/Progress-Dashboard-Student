import type { StudentProfile } from '@spd/shared'
import { firstName } from '../../lib/format'

type DashboardHeaderProps = {
  student: StudentProfile
  onOpenCoach: () => void
}

export function DashboardHeader({ student, onOpenCoach }: DashboardHeaderProps) {
  return (
    <header className="dashboard-header">
      <div className="dashboard-header__text">
        <p className="eyebrow">My learning</p>
        <h1>My Learning Dashboard</h1>
        <p className="lede">
          Track your progress, develop new skills, and explore your learning opportunities.
        </p>
        <p className="dashboard-header__greeting">Welcome back, {firstName(student.name)}.</p>
      </div>

      <div className="dashboard-header__actions">
        <button type="button" className="btn btn--primary" onClick={onOpenCoach}>
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
            <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z" />
          </svg>
          AI Coach
        </button>
      </div>
    </header>
  )
}
