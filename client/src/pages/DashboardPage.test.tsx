import { MOCK_DASHBOARD } from '@spd/shared'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { renderApp } from '../test/renderApp'
import { server } from '../test/server'

async function renderDashboard() {
  renderApp()
  await screen.findByRole('heading', { name: /your learning progress/i })
}

describe('dashboard', () => {
  it('shows the student name, authoritative overall progress, and reference-only module average', async () => {
    await renderDashboard()

    expect(screen.getByText('Welcome back, Aanya.')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: '34% of your course completed' }),
    ).toBeInTheDocument()

    const overall = screen.getByRole('region', { name: /34% of your course completed/i })
    expect(within(overall).getByText(/module average \(reference only\)/i)).toBeInTheDocument()
    expect(within(overall).getByText(/this is not your overall progress/i)).toBeInTheDocument()
    expect(within(overall).getByText(/not calculated by averaging/i)).toBeInTheDocument()
  })

  it('renders learning health with status, expected progress, pace, update age, and reasons', async () => {
    await renderDashboard()

    const health = screen.getByRole('region', { name: 'Learning health' })
    expect(within(health).getAllByText('Behind').length).toBeGreaterThan(0)
    expect(within(health).getByText('71%')).toBeInTheDocument()
    expect(within(health).getByText('34%')).toBeInTheDocument()
    expect(within(health).getByText(/0\.50x of expected pace/i)).toBeInTheDocument()
    expect(within(health).getAllByText(/46 days ago/i).length).toBeGreaterThan(0)
    expect(
      within(health).getByText('34% overall vs 71% expected for this cohort'),
    ).toBeInTheDocument()
    expect(within(health).getByText('Last progress update 46 days ago')).toBeInTheDocument()
  })

  it('groups track summaries in curated order and labels derived track progress', async () => {
    await renderDashboard()

    const tracks = screen.getByRole('region', { name: 'Learning tracks' })
    const trackNames = within(tracks)
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent)

    expect(trackNames).toEqual([
      'Foundations',
      'Data & Analytics',
      'AI & ML',
      'Production & Industry',
    ])
    expect(within(tracks).getAllByText(/track progress \(derived\)/i).length).toBe(4)
    expect(within(tracks).getAllByText(/not your overall progress/i).length).toBeGreaterThan(0)
  })

  it('renders all modules in curated catalog order', async () => {
    await renderDashboard()

    const modulesSection = screen.getByRole('region', { name: 'Your modules' })
    const moduleTitles = within(modulesSection)
      .getAllByRole('article')
      .map((article) => within(article).getByRole('heading', { level: 4 }).textContent)

    const expected = [...MOCK_DASHBOARD.modules]
      .sort((a, b) => a.catalogOrder - b.catalogOrder)
      .map((module) => module.name)

    expect(moduleTitles).toEqual(expected)
  })

  it('distinguishes a module outside the plan from an assigned module at 0%', async () => {
    await renderDashboard()

    const modulesSection = screen.getByRole('region', { name: 'Your modules' })
    const notInPlan = within(modulesSection).getByRole('article', { name: 'Distributed ML' })
    const notStarted = within(modulesSection).getByRole('article', { name: 'DL for NLP' })

    expect(within(notInPlan).getByText(/not included in your current plan/i)).toBeInTheDocument()
    expect(within(notInPlan).queryByText('0%')).not.toBeInTheDocument()
    expect(within(notInPlan).getByText('Not in Plan')).toBeInTheDocument()

    expect(within(notStarted).getByText('0%')).toBeInTheDocument()
    expect(within(notStarted).getByText('Not Started')).toBeInTheDocument()
  })

  it('provides accessible table equivalents for every chart', async () => {
    await renderDashboard()

    expect(screen.getByRole('heading', { name: 'Module progress comparison' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Learning track comparison' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Overall vs expected progress' })).toBeInTheDocument()

    expect(
      screen.getByRole('table', { name: 'Module progress comparison data' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('table', { name: 'Learning track comparison data' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('table', { name: 'Overall versus expected progress data' }),
    ).toBeInTheDocument()
  })

  it('clearly labels coach recommendations as mock previews', async () => {
    await renderDashboard()

    const coach = screen.getByRole('region', { name: 'Your AI Skill Coach' })
    expect(within(coach).getByText(/not live ai output/i)).toBeInTheDocument()
    expect(within(coach).getByText('Preview only')).toBeInTheDocument()
    expect(within(coach).getAllByText(/estimated from module progress/i).length).toBeGreaterThan(0)
    expect(within(coach).getAllByText(/low confidence/i).length).toBeGreaterThan(0)

    const planLinks = within(coach).getAllByRole('link', { name: 'View learning plan' })
    expect(planLinks).toHaveLength(2)
    expect(planLinks[0]).toHaveAttribute('href', '/modules/relational-databases#learning-plan')
  })

  it('shows an honest empty coach state when there are no recommendations', async () => {
    server.use(
      http.get('*/api/v1/me/dashboard', () =>
        HttpResponse.json({
          ...MOCK_DASHBOARD,
          coachSummary: { headline: 'No recommendations yet', recommendations: [] },
        }),
      ),
    )

    await renderDashboard()

    expect(screen.getByRole('heading', { name: 'No recommendations yet' })).toBeInTheDocument()
    expect(
      screen.getByText(/recommendations will appear here when the coach api is available/i),
    ).toBeInTheDocument()
  })

  it('shows empty chart states when no modules are in the plan', async () => {
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

    expect(screen.getByRole('heading', { name: 'No module progress yet' })).toBeInTheDocument()
    expect(screen.getAllByText(/no modules from this track are in your plan/i)).toHaveLength(4)
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
      await screen.findByRole('heading', { name: /your learning progress/i }),
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
