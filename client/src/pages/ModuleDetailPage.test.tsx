import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { renderApp } from '../test/renderApp'
import { server } from '../test/server'

async function renderModule(slug: string) {
  renderApp({ route: `/modules/${slug}` })
  return screen.findByRole('heading', { level: 1 })
}

describe('module detail', () => {
  it('renders progress, status, prerequisites, estimated skills, and activities', async () => {
    await renderModule('relational-databases')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Relational Databases' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Foundations')).toBeInTheDocument()
    expect(screen.getAllByText('Needs Attention').length).toBeGreaterThan(0)

    const progress = screen.getByRole('region', { name: 'Current progress' })
    expect(within(progress).getByText('35%')).toBeInTheDocument()

    const prerequisites = screen.getByRole('region', { name: 'Prerequisite modules' })
    expect(
      within(prerequisites).getByRole('link', { name: 'Intro to Computer Programming' }),
    ).toBeInTheDocument()
    expect(within(prerequisites).getByText(/100% complete/i)).toBeInTheDocument()

    const skills = screen.getByRole('region', { name: 'Estimated skills' })
    expect(within(skills).getByText('SQL joins')).toBeInTheDocument()
    expect(within(skills).getByText(/low confidence/i)).toBeInTheDocument()
    expect(within(skills).getAllByText('Estimated').length).toBeGreaterThan(0)

    const activities = screen.getByRole('region', { name: 'Suggested learning activities' })
    expect(within(activities).getByText('Practice 12 join queries')).toBeInTheDocument()
  })

  it('opens a clearly labeled fast-completion placeholder and closes it with Escape', async () => {
    const user = userEvent.setup()
    await renderModule('relational-databases')

    await user.click(
      await screen.findByRole('button', { name: /how to complete this module faster/i }),
    )

    const dialog = screen.getByRole('dialog', { name: /how to complete this module faster/i })
    expect(within(dialog).getByText(/clearly labeled preview placeholder/i)).toBeInTheDocument()
    expect(within(dialog).getByText(/not personalized ai advice/i)).toBeInTheDocument()
    expect(within(dialog).getByText(/catalog activity suggestions/i)).toBeInTheDocument()

    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('does not show a not-in-plan module as 0% assigned progress', async () => {
    await renderModule('distributed-ml')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Distributed ML' }),
    ).toBeInTheDocument()

    const progress = screen.getByRole('region', { name: 'Current progress' })
    expect(within(progress).getByText('Not in Plan')).toBeInTheDocument()
    expect(within(progress).getByText(/not part of your current enrollment/i)).toBeInTheDocument()
    expect(within(progress).queryByText('0%')).not.toBeInTheDocument()
  })

  it('shows a missing module state for an unknown slug', async () => {
    renderApp({ route: '/modules/not-a-real-module' })

    expect(
      await screen.findByRole('heading', { name: 'Module not found' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to dashboard' })).toBeInTheDocument()
  })

  it('shows a retryable error when the module request fails', async () => {
    server.use(
      http.get('*/api/v1/me/modules/:slug', () =>
        HttpResponse.json(
          { error: 'service_unavailable', message: 'Module service unavailable.' },
          { status: 503 },
        ),
      ),
    )

    renderApp({ route: '/modules/relational-databases' })

    expect(
      await screen.findByRole('heading', { name: /could not load this module/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('Module service unavailable.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
})
