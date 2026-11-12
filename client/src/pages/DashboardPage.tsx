import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { AnalyticsPanel } from '../components/dashboard/AnalyticsPanel'
import { CoachPanel } from '../components/dashboard/CoachPanel'
import { DashboardHeader } from '../components/dashboard/DashboardHeader'
import { HealthCard } from '../components/dashboard/HealthCard'
import { ModulesSection } from '../components/dashboard/ModulesSection'
import { OverallProgressCard } from '../components/dashboard/OverallProgressCard'
import { SkillographySection } from '../components/dashboard/SkillographySection'
import { TrackOverview } from '../components/dashboard/TrackOverview'
import { PageError, PageLoading } from '../components/feedback/AsyncState'
import { useDashboard } from '../hooks/useDashboard'

export function DashboardPage() {
  const { state, reload } = useDashboard()
  const { logout } = useAuth()
  const navigate = useNavigate()

  if (state.status === 'loading') {
    return <PageLoading label="Loading your progress..." />
  }

  if (state.status === 'error') {
    const unauthorized = state.error.isUnauthorized

    async function handleSignInAgain() {
      await logout()
      navigate('/login', { replace: true })
    }

    return (
      <PageError
        title={unauthorized ? 'Your session has expired' : 'We could not load your dashboard'}
        message={
          unauthorized
            ? 'For your security, please sign in again to view your progress.'
            : state.error.message
        }
        actionLabel={unauthorized ? 'Sign in again' : 'Try again'}
        onAction={unauthorized ? () => void handleSignInAgain() : reload}
      />
    )
  }

  const data = state.data

  return (
    <div className="page-stack">
      <DashboardHeader student={data.student} />

      <div className="summary-grid">
        <OverallProgressCard
          overallProgressPct={data.overallProgressPct}
          progressComparison={data.progressComparison}
        />
        <HealthCard
          health={data.health}
          overallProgressPct={data.overallProgressPct}
          progressUpdatedAt={data.enrollment.progressUpdatedAt}
        />
      </div>

      <TrackOverview tracks={data.tracks} modules={data.modules} />
      <ModulesSection modules={data.modules} />
      <SkillographySection />
      <AnalyticsPanel data={data} />
      <CoachPanel summary={data.coachSummary} />
    </div>
  )
}
