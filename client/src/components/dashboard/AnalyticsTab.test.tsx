import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderApp } from '../../test/renderApp'

async function openAnalyticsTab() {
  const user = userEvent.setup()
  renderApp()
  await screen.findByRole('heading', { name: /my learning dashboard/i })
  await user.click(screen.getByRole('tab', { name: 'Analytics' }))
  await screen.findByRole('heading', { name: 'Analytics' })
  return user
}

describe('analytics', () => {
  it('renders overall versus expected progress with a table equivalent', async () => {
    await openAnalyticsTab()

    expect(
      screen.getByRole('heading', { name: 'Overall vs expected progress' }),
    ).toBeInTheDocument()
    const table = screen.getByRole('table', { name: 'Overall versus expected progress data' })
    expect(within(table).getByText('34%')).toBeInTheDocument()
    expect(within(table).getByText('71%')).toBeInTheDocument()
  })

  it('shows backend-provided pace metrics without recalculating health in the client', async () => {
    await openAnalyticsTab()

    const pace = screen.getByRole('region', { name: 'Learning pace' })
    expect(within(pace).getAllByText('Behind').length).toBeGreaterThan(0)
    expect(within(pace).getByText('0.50x')).toBeInTheDocument()
    expect(within(pace).getByText('71%')).toBeInTheDocument()
    expect(within(pace).getAllByText(/46 days ago/).length).toBeGreaterThan(0)
    expect(
      within(pace).getByText('34% overall vs 71% expected for this cohort'),
    ).toBeInTheDocument()
    expect(within(pace).getByText('Last progress update 46 days ago')).toBeInTheDocument()
  })

  it('filters the module comparison chart by track', async () => {
    const user = await openAnalyticsTab()

    const table = screen.getByRole('table', { name: 'Module progress comparison data' })
    expect(within(table).getAllByRole('row')).toHaveLength(12)

    await user.selectOptions(screen.getByLabelText('Track filter'), 'foundations')

    const filtered = await screen.findByRole('table', {
      name: 'Module progress comparison data',
    })
    const rows = within(filtered).getAllByRole('row')
    expect(rows).toHaveLength(4)
    expect(within(filtered).getByText('Intro to Computer Programming')).toBeInTheDocument()
    expect(within(filtered).getByText('Numerical Programming in Python')).toBeInTheDocument()
    expect(within(filtered).getByText('Relational Databases')).toBeInTheDocument()
    expect(within(filtered).queryByText('Data Visualization Tools')).not.toBeInTheDocument()
  })

  it('opens a module from the attention areas', async () => {
    const user = await openAnalyticsTab()

    const attention = screen.getByRole('region', { name: 'Attention areas' })
    const firstAttention = within(attention).getAllByRole('button')[0]!
    await user.click(firstAttention)

    const dialog = await screen.findByRole('dialog')
    expect(
      await within(dialog).findByRole('heading', { name: 'Relational Databases' }),
    ).toBeInTheDocument()
  })

  it('provides a review action for the first attention area', async () => {
    const user = await openAnalyticsTab()

    await user.click(screen.getByRole('button', { name: 'Review first attention area' }))

    const dialog = await screen.findByRole('dialog')
    expect(
      await within(dialog).findByRole('heading', { name: 'Relational Databases' }),
    ).toBeInTheDocument()
  })
})
