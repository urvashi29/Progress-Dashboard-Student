import { MOCK_DASHBOARD } from '@spd/shared'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { renderApp } from '../../test/renderApp'
import { server } from '../../test/server'

async function openCoach() {
  const user = userEvent.setup()
  renderApp()
  await screen.findByRole('heading', { name: /my learning dashboard/i })
  const trigger = screen.getByRole('button', { name: 'AI Coach' })
  await user.click(trigger)
  return { user, trigger }
}

describe('AI Coach drawer', () => {
  it('shows three progress-based recommendations with explanations and skills', async () => {
    const { user } = await openCoach()

    const dialog = await screen.findByRole('dialog', { name: 'AI Coach' })
    expect(within(dialog).getByText('Deterministic fallback')).toBeInTheDocument()
    expect(
      within(dialog).getByRole('heading', { name: 'Recommended next modules' }),
    ).toBeInTheDocument()

    expect(
      await within(dialog).findByRole('article', { name: 'Numerical Programming in Python' }),
    ).toBeInTheDocument()
    expect(
      within(dialog).getByRole('article', { name: 'Relational Databases' }),
    ).toBeInTheDocument()
    expect(
      within(dialog).getByRole('article', { name: 'Data Visualization Tools' }),
    ).toBeInTheDocument()

    const first = within(dialog).getByRole('article', {
      name: 'Numerical Programming in Python',
    })
    expect(within(first).getByText('Finish Numerical Programming in Python')).toBeInTheDocument()
    expect(within(first).getByText(/80% through Numerical Programming in Python/i)).toBeInTheDocument()
    expect(within(first).getByText('Python programming')).toBeInTheDocument()
    expect(within(first).getByRole('button', { name: 'Continue Module' })).toBeInTheDocument()

    expect(within(dialog).queryByText(/scored \d+%/i)).not.toBeInTheDocument()

    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('moves focus into the drawer and restores it on close', async () => {
    const { user, trigger } = await openCoach()

    const dialog = await screen.findByRole('dialog', { name: 'AI Coach' })
    expect(within(dialog).getByRole('button', { name: 'Close panel' })).toHaveFocus()

    await user.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(trigger).toHaveFocus()
  })

  it('shows a loading state before recommendations arrive', async () => {
    let resolveResponse: (() => void) | undefined

    server.use(
      http.get(
        '*/api/v1/me/coach',
        () =>
          new Promise((resolve) => {
            resolveResponse = () => resolve(HttpResponse.json(MOCK_DASHBOARD.coachSummary))
          }),
      ),
    )

    await openCoach()

    const dialog = await screen.findByRole('dialog', { name: 'AI Coach' })
    expect(await within(dialog).findByText(/loading coach recommendations/i)).toBeInTheDocument()

    resolveResponse?.()

    expect(
      await within(dialog).findByText('Finish Numerical Programming in Python'),
    ).toBeInTheDocument()
  })

  it('shows a retryable error state', async () => {
    let calls = 0

    server.use(
      http.get('*/api/v1/me/coach', () => {
        calls += 1
        if (calls === 1) {
          return HttpResponse.json(
            { error: 'server_error', message: 'Coach service is unavailable.' },
            { status: 500 },
          )
        }
        return HttpResponse.json(MOCK_DASHBOARD.coachSummary)
      }),
    )

    const { user } = await openCoach()

    expect(
      await screen.findByRole('heading', { name: /could not load coach recommendations/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('Coach service is unavailable.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Try again' }))

    const dialog = screen.getByRole('dialog', { name: 'AI Coach' })
    expect(
      await within(dialog).findByText('Finish Numerical Programming in Python'),
    ).toBeInTheDocument()
  })

  it('loads how-to-complete guidance for a selected module', async () => {
    const { user } = await openCoach()

    const dialog = await screen.findByRole('dialog', { name: 'AI Coach' })
    const first = await within(dialog).findByRole('article', {
      name: 'Numerical Programming in Python',
    })
    await user.click(
      within(first).getByRole('button', { name: 'How to Complete This Module' }),
    )

    expect(
      await within(dialog).findByText(/continue the remaining module content/i),
    ).toBeInTheDocument()
    expect(within(dialog).getAllByText('Deterministic fallback').length).toBeGreaterThan(0)
  })

  it('answers a contextual Ask AI Coach question', async () => {
    const { user } = await openCoach()

    const dialog = await screen.findByRole('dialog', { name: 'AI Coach' })
    const input = await within(dialog).findByPlaceholderText('What should I focus on next?')
    await user.type(input, 'What should I do next?')
    await user.click(within(dialog).getByRole('button', { name: 'Ask' }))

    expect(
      await within(dialog).findByText(/ask answer: continue the first recommended module/i),
    ).toBeInTheDocument()
  })
})
