import type { TrackSlug } from '@spd/shared'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { AiCoachDrawer, type CoachContext } from '../components/dashboard/AiCoachDrawer'
import { AnalyticsTab } from '../components/dashboard/AnalyticsTab'
import { DashboardHeader } from '../components/dashboard/DashboardHeader'
import { DashboardTabs } from '../components/dashboard/DashboardTabs'
import { ModuleDetailDrawer } from '../components/dashboard/ModuleDetailDrawer'
import { ModulesTab } from '../components/dashboard/ModulesTab'
import { OverviewTab } from '../components/dashboard/OverviewTab'
import { SkillographyTab } from '../components/dashboard/SkillographyTab'
import { TracksTab } from '../components/dashboard/TracksTab'
import { PageError, PageLoading } from '../components/feedback/AsyncState'
import { useDashboard } from '../hooks/useDashboard'
import { useSkillography } from '../hooks/useSkillography'
import { isDashboardTab, type DashboardTabId } from '../lib/tabs'

export function DashboardPage() {
  const { state, reload } = useDashboard()
  const skillography = useSkillography()
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [coachContext, setCoachContext] = useState<CoachContext | null>(null)
  const [moduleSlug, setModuleSlug] = useState<string | null>(null)
  const [selectedTrack, setSelectedTrack] = useState<TrackSlug | null>(null)

  const tabParam = searchParams.get('tab')
  const activeTab: DashboardTabId = isDashboardTab(tabParam) ? tabParam : 'overview'

  function navigateTab(tab: DashboardTabId) {
    const next = new URLSearchParams(searchParams)
    next.set('tab', tab)
    setSearchParams(next, { replace: true })
  }

  function openCoach(context: CoachContext = { type: 'general' }) {
    setCoachContext(context)
  }

  function selectTrack(track: TrackSlug) {
    setSelectedTrack(track)
    navigateTab('tracks')
  }

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
      <DashboardHeader student={data.student} onOpenCoach={() => openCoach()} />

      <DashboardTabs activeTab={activeTab} onChange={navigateTab} />

      <div
        id={`dashboard-panel-${activeTab}`}
        className="tab-panel"
        role="tabpanel"
        aria-labelledby={`dashboard-tab-${activeTab}`}
        tabIndex={0}
      >
        {activeTab === 'overview' ? (
          <OverviewTab
            data={data}
            skillography={skillography.state}
            onNavigateTab={navigateTab}
            onOpenCoach={() => openCoach()}
            onOpenModule={setModuleSlug}
            onSelectTrack={selectTrack}
          />
        ) : null}

        {activeTab === 'modules' ? (
          <ModulesTab modules={data.modules} onOpenModule={setModuleSlug} />
        ) : null}

        {activeTab === 'tracks' ? (
          <TracksTab
            tracks={data.tracks}
            modules={data.modules}
            selectedTrack={selectedTrack}
            onSelectTrack={setSelectedTrack}
            onOpenModule={setModuleSlug}
          />
        ) : null}

        {activeTab === 'analytics' ? (
          <AnalyticsTab data={data} onOpenModule={setModuleSlug} />
        ) : null}

        {activeTab === 'skillography' ? (
          <SkillographyTab
            state={skillography.state}
            reload={skillography.reload}
            onOpenCoach={openCoach}
            onOpenModule={setModuleSlug}
          />
        ) : null}
      </div>

      {moduleSlug ? (
        <ModuleDetailDrawer
          slug={moduleSlug}
          onClose={() => setModuleSlug(null)}
          onOpenCoach={(context) => {
            setModuleSlug(null)
            openCoach(context)
          }}
          onOpenSkillography={() => {
            setModuleSlug(null)
            navigateTab('skillography')
          }}
        />
      ) : null}

      {coachContext ? (
        <AiCoachDrawer
          context={coachContext}
          onClose={() => setCoachContext(null)}
          onOpenModule={setModuleSlug}
        />
      ) : null}
    </div>
  )
}
