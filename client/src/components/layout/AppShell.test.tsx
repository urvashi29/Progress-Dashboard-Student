import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderApp } from '../../test/renderApp'

async function renderDashboard() {
  renderApp()
  await screen.findByRole('heading', { name: /your learning progress/i })
}

describe('application shell', () => {
  it('has a single sidebar navigation item, Progress Dashboard', async () => {
    await renderDashboard()

    const mainNav = screen.getByRole('navigation', { name: 'Main' })
    const links = within(mainNav).getAllByRole('link')

    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAccessibleName('Progress Dashboard')
  })

  it('navigates from a module detail page back to the dashboard from the sidebar', async () => {
    const user = userEvent.setup()
    await renderDashboard()

    await user.click(screen.getByRole('link', { name: /view relational databases module details/i }))
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Relational Databases' }),
    ).toBeInTheDocument()

    const mainNav = screen.getByRole('navigation', { name: 'Main' })
    await user.click(within(mainNav).getByRole('link', { name: 'Progress Dashboard' }))

    expect(
      await screen.findByRole('heading', { name: /your learning progress/i }),
    ).toBeInTheDocument()
  })

  it('toggles the responsive navigation with the menu button and Escape', async () => {
    const user = userEvent.setup()
    await renderDashboard()

    const menuButton = screen.getByRole('button', { name: 'Menu' })
    expect(menuButton).toHaveAttribute('aria-expanded', 'false')

    await user.click(menuButton)
    expect(menuButton).toHaveAttribute('aria-expanded', 'true')

    await user.keyboard('{Escape}')
    expect(menuButton).toHaveAttribute('aria-expanded', 'false')
  })

  it('provides a first-focusable skip link to the main content', async () => {
    const user = userEvent.setup()
    await renderDashboard()

    await user.tab()

    expect(screen.getByRole('link', { name: /skip to main content/i })).toHaveFocus()
  })

  it('shows the dashboard title, student name, and logout action in the top header', async () => {
    await renderDashboard()

    const header = screen.getByRole('banner', { name: 'Application header' })
    expect(within(header).getByText('Progress Dashboard')).toBeInTheDocument()
    expect(within(header).getByText('Aanya Fictional')).toBeInTheDocument()
    expect(
      within(header).getByRole('button', { name: 'Log out of your account' }),
    ).toBeInTheDocument()
  })

  it('logs out from the sidebar', async () => {
    const user = userEvent.setup()
    await renderDashboard()

    await user.click(screen.getByRole('button', { name: 'Log out' }))

    expect(
      await screen.findByRole('heading', { name: /sign in to your progress dashboard/i }),
    ).toBeInTheDocument()
  })
})
