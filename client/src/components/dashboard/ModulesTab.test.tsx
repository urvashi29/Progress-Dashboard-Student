import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderApp } from '../../test/renderApp'

async function openModulesTab() {
  const user = userEvent.setup()
  renderApp()
  await screen.findByRole('heading', { name: /my learning dashboard/i })
  await user.click(screen.getByRole('tab', { name: 'Modules' }))
  await screen.findByRole('heading', { name: 'Module explorer' })
  return user
}

describe('modules explorer', () => {
  it('searches modules and associated skills, then clears filters', async () => {
    const user = await openModulesTab()

    expect(screen.getByText('13 of 13 modules')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Search modules'), 'SQL')

    expect(await screen.findByText('1 of 13 modules')).toBeInTheDocument()
    expect(screen.getByRole('article', { name: 'Relational Databases' })).toBeInTheDocument()
    expect(screen.queryByRole('article', { name: 'Data Visualization Tools' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Clear filters' }))

    expect(await screen.findByText('13 of 13 modules')).toBeInTheDocument()
    expect(screen.getByLabelText('Search modules')).toHaveValue('')
  })

  it('filters by track and progress status', async () => {
    const user = await openModulesTab()

    await user.selectOptions(screen.getByLabelText('Track'), 'foundations')
    expect(await screen.findByText('3 of 13 modules')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Progress status'), 'completed')
    expect(await screen.findByText('1 of 13 modules')).toBeInTheDocument()
    expect(screen.getByRole('article', { name: 'Intro to Computer Programming' })).toBeInTheDocument()
    expect(screen.queryByRole('article', { name: 'Relational Databases' })).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Track'), 'all')
    expect(await screen.findByText('1 of 13 modules')).toBeInTheDocument()
  })

  it('sorts modules by progress while keeping not-in-plan modules last', async () => {
    const user = await openModulesTab()

    await user.selectOptions(screen.getByLabelText('Sort by'), 'progress-desc')

    const titles = screen
      .getAllByRole('article')
      .map((article) => within(article).getByRole('heading', { level: 3 }).textContent)

    expect(titles.slice(0, 4)).toEqual([
      'Intro to Computer Programming',
      'Numerical Programming in Python',
      'Data Visualization Tools',
      'Relational Databases',
    ])
    expect(titles.slice(-2)).toEqual(['Distributed ML', 'Industry Immersion'])
  })

  it('shows an empty state and lets the user clear filters', async () => {
    const user = await openModulesTab()

    await user.type(screen.getByLabelText('Search modules'), 'zzzz-no-match')

    expect(
      await screen.findByRole('heading', { name: 'No modules match your filters' }),
    ).toBeInTheDocument()

    const emptyState = screen.getByRole('heading', { name: 'No modules match your filters' }).closest('div')
    expect(emptyState).not.toBeNull()
    await user.click(within(emptyState as HTMLElement).getByRole('button', { name: 'Clear filters' }))

    expect(await screen.findByText('13 of 13 modules')).toBeInTheDocument()
  })

  it('opens module details in a drawer and closes it with Escape', async () => {
    const user = await openModulesTab()

    const article = screen.getByRole('article', { name: 'Relational Databases' })
    await user.click(within(article).getByRole('button', { name: 'View Details' }))

    const dialog = await screen.findByRole('dialog')
    expect(
      await within(dialog).findByRole('heading', { name: 'Relational Databases' }),
    ).toBeInTheDocument()
    expect(within(dialog).getByText('35%')).toBeInTheDocument()
    expect(within(dialog).getByRole('heading', { name: /associated skills \(estimated\)/i })).toBeInTheDocument()
    expect(within(dialog).getAllByText(/SQL joins/).length).toBeGreaterThan(0)
    expect(within(dialog).getByRole('heading', { name: 'Prerequisites' })).toBeInTheDocument()

    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('opens the AI Coach from module details with module context', async () => {
    const user = await openModulesTab()

    const article = screen.getByRole('article', { name: 'Relational Databases' })
    await user.click(within(article).getByRole('button', { name: 'View Details' }))

    const moduleDialog = await screen.findByRole('dialog')
    await within(moduleDialog).findByRole('heading', { name: 'Relational Databases' })
    await user.click(within(moduleDialog).getByRole('button', { name: 'Explore with AI Coach' }))

    const coachDialog = await screen.findByRole('dialog', { name: 'AI Coach' })
    expect(await within(coachDialog).findByText('Context: Relational Databases')).toBeInTheDocument()
    expect(within(coachDialog).getByText('Continue Relational Databases')).toBeInTheDocument()
  })

  it('distinguishes a not-in-plan module from an assigned module at 0%', async () => {
    await openModulesTab()

    const notInPlan = screen.getByRole('article', { name: 'Distributed ML' })
    const notStarted = screen.getByRole('article', { name: 'DL for NLP' })

    expect(within(notInPlan).getByText(/not included in your current plan/i)).toBeInTheDocument()
    expect(within(notInPlan).queryByRole('progressbar')).not.toBeInTheDocument()
    expect(within(notInPlan).getByText('Not in Plan')).toBeInTheDocument()

    expect(within(notStarted).getByText('0%')).toBeInTheDocument()
    expect(within(notStarted).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
    expect(within(notStarted).getByText('Not Started')).toBeInTheDocument()
  })
})
