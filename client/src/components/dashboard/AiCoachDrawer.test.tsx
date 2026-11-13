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
  it('opens from the dashboard header as a clearly labeled preview', async () => {
    const { user } = await openCoach()

    const dialog = await screen.findByRole('dialog', { name: 'AI Coach' })
    expect(within(dialog).getByText('Preview only')).toBeInTheDocument()
    expect(
      within(dialog).getByText(/live personalized ai coaching is not connected yet/i),
    ).toBeInTheDocument()
    expect(await within(dialog).findByText('Rescue Relational Databases')).toBeInTheDocument()
    expect(
      within(dialog).getByRole('heading', { name: 'Why this is relevant' }),
    ).toBeInTheDocument()
    expect(
      within(dialog).getByRole('heading', { name: 'Suggested learning activities' }),
    ).toBeInTheDocument()

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
            resolveResponse = () =>
              resolve(
                HttpResponse.json({
                  headline: 'Focus on Relational Databases',
                  recommendations: [
                    {
                      id: 'rec-1',
                      type: 'RESCUE_MODULE',
                      moduleSlug: 'relational-databases',
                      title: 'Rescue Relational Databases',
                      reason: 'Progress is behind the expected pace.',
                      priority: 1,
                      estimatedMinutes: 180,
                      expectedGainPct: 20,
                    },
                  ],
                }),
              )
          }),
      ),
    )

    await openCoach()

    const dialog = await screen.findByRole('dialog', { name: 'AI Coach' })
    expect(await within(dialog).findByText(/loading coach recommendations/i)).toBeInTheDocument()

    resolveResponse?.()

    expect(await within(dialog).findByText('Rescue Relational Databases')).toBeInTheDocument()
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
        return HttpResponse.json({
          headline: 'Focus on Relational Databases',
          recommendations: [
            {
              id: 'rec-1',
              type: 'RESCUE_MODULE',
              moduleSlug: 'relational-databases',
              title: 'Rescue Relational Databases',
              reason: 'Progress is behind the expected pace.',
              priority: 1,
              estimatedMinutes: 180,
              expectedGainPct: 20,
            },
          ],
        })
      }),
    )

    const { user } = await openCoach()

    expect(
      await screen.findByRole('heading', { name: /could not load coach recommendations/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('Coach service is unavailable.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Try again' }))

    const dialog = screen.getByRole('dialog', { name: 'AI Coach' })
    expect(await within(dialog).findByText('Rescue Relational Databases')).toBeInTheDocument()
  })
})
