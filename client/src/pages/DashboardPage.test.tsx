import { MOCK_DASHBOARD } from '@spd/shared'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { MOCK_SKILLOGRAPHY } from '../mocks/skillography'
import { renderApp } from '../test/renderApp'
import { server } from '../test/server'

async function renderDashboard() {
  renderApp()
  await screen.findByRole('heading', { name: /my learning dashboard/i })
}

describe('dashboard', () => {
  it('renders the redesigned header with the student greeting and AI Coach action', async () => {
    await renderDashboard()

    expect(screen.getByRole('heading', { level: 1, name: 'My Learning Dashboard' })).toBeInTheDocument()
    expect(
      screen.getByText(
        'Track your progress, develop new skills, and explore your learning opportunities.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('Welcome back, Aanya.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'AI Coach' })).toBeInTheDocument()
  })

  it('shows four summary cards using authoritative API values', async () => {
    await renderDashboard()

    const overall = screen.getByRole('button', { name: /overall progress/i })
    expect(within(overall).getByText('34%')).toBeInTheDocument()
    expect(within(overall).getByText(/authoritative platform value/i)).toBeInTheDocument()

    const modules = screen.getByRole('button', { name: /modules completed/i })
    expect(within(modules).getByText('1/11')).toBeInTheDocument()

    const pace = screen.getByRole('button', { name: /learning pace/i })
    expect(within(pace).getByText('Behind')).toBeInTheDocument()
    expect(within(pace).getByText('0.50x of expected pace')).toBeInTheDocument()

    const expectedSkills = MOCK_SKILLOGRAPHY.skills.filter(
      (skill) => skill.status !== 'NOT_IN_PLAN',
    ).length
    const skills = screen.getByRole('button', { name: /estimated skills/i })
    expect(await within(skills).findByText(String(expectedSkills))).toBeInTheDocument()
  })

  it('renders the overview snapshot, continue-learning cards and coach preview', async () => {
    await renderDashboard()

    expect(screen.getByRole('heading', { name: 'Continue learning' })).toBeInTheDocument()
    const continueSection = screen.getByRole('region', { name: 'Continue learning' })
    const continueCards = within(continueSection).getAllByRole('article')
    expect(continueCards).toHaveLength(3)
    expect(within(continueCards[0]!).getByRole('heading', { name: 'Numerical Programming in Python' })).toBeInTheDocument()
    expect(within(continueCards[1]!).getByRole('heading', { name: 'Relational Databases' })).toBeInTheDocument()
    expect(within(continueCards[2]!).getByRole('heading', { name: 'Data Visualization Tools' })).toBeInTheDocument()

    const tracks = screen.getByRole('region', { name: 'Learning track snapshot' })
    const trackNames = within(tracks)
      .getAllByRole('button', { name: /^View .* track$/ })
      .map((button) => button.getAttribute('aria-label'))
    expect(trackNames).toEqual([
      'View Foundations track',
      'View Data & Analytics track',
      'View AI & ML track',
      'View Production & Industry track',
    ])

    const coachPreview = screen.getByRole('region', { name: 'Your Next Learning Step' })
    expect(within(coachPreview).getByText('Finish Numerical Programming in Python')).toBeInTheDocument()
    expect(within(coachPreview).getByText('Progress-based')).toBeInTheDocument()
    expect(within(coachPreview).getByRole('button', { name: /explore with ai coach/i })).toBeInTheDocument()
  })

  it('exposes five dashboard tabs with Overview selected by default', async () => {
    await renderDashboard()

    const tablist = screen.getByRole('tablist', { name: 'Dashboard sections' })
    const tabs = within(tablist).getAllByRole('tab')
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      'Overview',
      'Modules',
      'Learning Tracks',
      'Analytics',
      'Skillography',
    ])
    expect(within(tablist).getByRole('tab', { name: 'Overview' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('switches tabs and updates the selected state', async () => {
    const user = userEvent.setup()
    await renderDashboard()

    await user.click(screen.getByRole('tab', { name: 'Modules' }))

    expect(await screen.findByRole('heading', { name: 'Module explorer' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Modules' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('heading', { name: 'My Learning Dashboard' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Continue learning' })).not.toBeInTheDocument()
  })

  it('supports keyboard navigation across the dashboard tabs', async () => {
    const user = userEvent.setup()
    await renderDashboard()

    const tablist = screen.getByRole('tablist', { name: 'Dashboard sections' })
    const overview = within(tablist).getByRole('tab', { name: 'Overview' })
    overview.focus()

    await user.keyboard('{ArrowRight}')
    expect(await screen.findByRole('heading', { name: 'Module explorer' })).toBeInTheDocument()
    expect(within(tablist).getByRole('tab', { name: 'Modules' })).toHaveAttribute(
      'aria-selected',
      'true',
    )

    await user.keyboard('{End}')
    expect(await screen.findByRole('heading', { name: 'Skillography' })).toBeInTheDocument()
    expect(within(tablist).getByRole('tab', { name: 'Skillography' })).toHaveAttribute(
      'aria-selected',
      'true',
    )

    await user.keyboard('{Home}')
    expect(await screen.findByRole('heading', { name: 'Continue learning' })).toBeInTheDocument()
    expect(within(tablist).getByRole('tab', { name: 'Overview' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('navigates to a tab from a summary card', async () => {
    const user = userEvent.setup()
    await renderDashboard()

    await user.click(screen.getByRole('button', { name: /modules completed/i }))

    expect(await screen.findByRole('heading', { name: 'Module explorer' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Modules' })).toHaveAttribute('aria-selected', 'true')
  })

  it('shows an honest empty coach state when there are no recommendations', async () => {
    server.use(
      http.get('*/api/v1/me/dashboard', () =>
        HttpResponse.json({
          ...MOCK_DASHBOARD,
          coachSummary: {
            ...MOCK_DASHBOARD.coachSummary,
            headline: 'No module recommendations yet',
            recommendations: [],
          },
        }),
      ),
    )

    await renderDashboard()

    expect(
      screen.getByText(/no incomplete module recommendations are available/i),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /explore with ai coach/i })).toBeInTheDocument()
  })

  it('shows empty track snapshot states when no modules are in the plan', async () => {
    const emptyPlan = {
      ...MOCK_DASHBOARD,
      modules: MOCK_DASHBOARD.modules.map((module) => ({
        ...module,
        inPlan: false,
        band: 'NOT_IN_PLAN' as const,
      })),
      tracks: MOCK_DASHBOARD.tracks.map((track) => ({
        ...track,
        inPlanCount: 0,
        averageProgressPct: null,
      })),
      progressComparison: {
        ...MOCK_DASHBOARD.progressComparison,
        moduleAveragePct: null,
        differenceFromOverallPct: null,
      },
    }

    server.use(http.get('*/api/v1/me/dashboard', () => HttpResponse.json(emptyPlan)))

    await renderDashboard()

    expect(screen.getAllByText(/no modules from this track are in your plan/i)).toHaveLength(4)
    expect(
      screen.getByText('You have no incomplete modules in your current plan.'),
    ).toBeInTheDocument()
  })

  it('shows a loading state while the dashboard request is pending', async () => {
    server.use(
      http.get('*/api/v1/me/dashboard', async () => {
        await delay(150)
        return HttpResponse.json(MOCK_DASHBOARD)
      }),
    )

    renderApp()

    expect(await screen.findByText(/loading your progress/i)).toBeInTheDocument()
    expect(
      await screen.findByRole('heading', { name: 'My Learning Dashboard' }),
    ).toBeInTheDocument()
  })

  it('shows a retryable error state when the dashboard request fails', async () => {
    server.use(
      http.get('*/api/v1/me/dashboard', () =>
        HttpResponse.json(
          { error: 'service_unavailable', message: 'The dashboard service is unavailable.' },
          { status: 503 },
        ),
      ),
    )

    renderApp()

    expect(
      await screen.findByRole('heading', { name: /could not load your dashboard/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('The dashboard service is unavailable.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('handles an expired session and offers a sign-in action', async () => {
    const user = userEvent.setup()

    server.use(
      http.get('*/api/v1/me/dashboard', () =>
        HttpResponse.json({ error: 'unauthorized', message: 'Session expired.' }, { status: 401 }),
      ),
    )

    renderApp()

    expect(
      await screen.findByRole('heading', { name: /your session has expired/i }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Sign in again' }))

    expect(
      await screen.findByRole('heading', { name: /sign in to your progress dashboard/i }),
    ).toBeInTheDocument()
  })
})
