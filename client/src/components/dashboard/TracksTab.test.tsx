import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderApp } from '../../test/renderApp'

async function openTracksTab() {
  const user = userEvent.setup()
  renderApp()
  await screen.findByRole('heading', { name: /my learning dashboard/i })
  await user.click(screen.getByRole('tab', { name: 'Learning Tracks' }))
  await screen.findByRole('heading', { name: 'Learning tracks' })
  return user
}

describe('learning tracks', () => {
  it('compares the four tracks and provides an accessible table equivalent', async () => {
    await openTracksTab()

    const region = screen.getByRole('region', { name: 'Learning tracks' })
    expect(within(region).getByRole('heading', { name: 'Track comparison' })).toBeInTheDocument()
    expect(
      within(region).getByRole('table', { name: 'Learning track comparison data' }),
    ).toBeInTheDocument()

    const trackCards = within(region).getAllByRole('button', { name: /Reference only/ })
    expect(trackCards).toHaveLength(4)
    expect(trackCards.map((card) => within(card).getByRole('heading').textContent)).toEqual([
      'Foundations',
      'Data & Analytics',
      'AI & ML',
      'Production & Industry',
    ])
  })

  it('selects a track, shows contributing modules, and returns to all tracks', async () => {
    const user = await openTracksTab()

    const region = screen.getByRole('region', { name: 'Learning tracks' })
    await user.click(within(region).getByRole('button', { name: /^Foundations/ }))

    const returnButton = await within(region).findByRole('button', { name: 'Return to all tracks' })
    const detailPanel = returnButton.closest('.panel') as HTMLElement

    expect(within(detailPanel).getByRole('heading', { name: 'Foundations' })).toBeInTheDocument()
    expect(within(detailPanel).getByText('Intro to Computer Programming')).toBeInTheDocument()
    expect(within(detailPanel).getByText('Numerical Programming in Python')).toBeInTheDocument()
    expect(within(detailPanel).getByText('Relational Databases')).toBeInTheDocument()

    await user.click(returnButton)

    expect(
      await within(region).findByText(/select a track bar or card to see the modules/i),
    ).toBeInTheDocument()
  })

  it('opens a contributing module in the detail drawer from a selected track', async () => {
    const user = await openTracksTab()

    const region = screen.getByRole('region', { name: 'Learning tracks' })
    await user.click(within(region).getByRole('button', { name: /^AI & ML/ }))

    const returnButton = await within(region).findByRole('button', { name: 'Return to all tracks' })
    const detailPanel = returnButton.closest('.panel') as HTMLElement
    const moduleRow = within(detailPanel).getByText('Advanced Machine Learning').closest('.track-module') as HTMLElement

    await user.click(within(moduleRow).getByRole('button', { name: 'View Details' }))

    const dialog = await screen.findByRole('dialog')
    expect(
      await within(dialog).findByRole('heading', { name: 'Advanced Machine Learning' }),
    ).toBeInTheDocument()
    expect(within(dialog).getByText('20%')).toBeInTheDocument()
  })

  it('opens the Learning Tracks tab with a preselected track from the overview snapshot', async () => {
    const user = userEvent.setup()
    renderApp()
    await screen.findByRole('heading', { name: /my learning dashboard/i })

    const snapshot = screen.getByRole('region', { name: 'Learning track snapshot' })
    await user.click(within(snapshot).getByRole('button', { name: 'View AI & ML track' }))

    expect(await screen.findByRole('heading', { name: 'Learning tracks' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Learning Tracks' })).toHaveAttribute(
      'aria-selected',
      'true',
    )

    const region = screen.getByRole('region', { name: 'Learning tracks' })
    const aiTrackCard = within(region).getByRole('button', { name: /^AI & ML/ })
    expect(aiTrackCard).toHaveAttribute('aria-pressed', 'true')
  })
})
