import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { MOCK_SKILLOGRAPHY } from '../../mocks/skillography'
import { renderApp } from '../../test/renderApp'
import { server } from '../../test/server'

async function openSkillographyTab() {
  const user = userEvent.setup()
  renderApp()
  await screen.findByRole('heading', { name: /my learning dashboard/i })
  await user.click(screen.getByRole('tab', { name: 'Skillography' }))
  await screen.findByRole('heading', { name: 'Skillography' })
  return user
}

describe('skillography', () => {
  it('labels exposure as estimated and separates it from module completion', async () => {
    await openSkillographyTab()

    expect(
      screen.getByText(/module completion is not proficiency/i),
    ).toBeInTheDocument()
    expect((await screen.findAllByText(/estimated skill exposure/i)).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/low confidence/i).length).toBeGreaterThan(0)
  })

  it('searches and filters skills by track', async () => {
    const user = await openSkillographyTab()

    await user.selectOptions(await screen.findByLabelText('Track'), 'foundations')

    expect(await screen.findByRole('button', { name: /SQL joins/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /CNN architectures/ })).not.toBeInTheDocument()

    await user.type(screen.getByLabelText('Search skills'), 'SQL')

    expect(await screen.findByRole('button', { name: /SQL joins/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Python programming/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /CNN architectures/ })).not.toBeInTheDocument()
  })

  it('opens the skill-to-module explorer with related modules and activities', async () => {
    const user = await openSkillographyTab()

    await user.click(await screen.findByRole('button', { name: /SQL joins/ }))

    expect(
      screen.getByRole('tab', { name: 'Skill-to-Module Explorer' }),
    ).toHaveAttribute('aria-selected', 'true')
    const detailHeading = screen.getByRole('heading', { level: 3, name: 'SQL joins' })
    expect(detailHeading).toBeInTheDocument()

    expect(screen.getByRole('heading', { name: 'Related modules' })).toBeInTheDocument()
    expect(screen.getByText('Relational Databases')).toBeInTheDocument()
    expect(screen.getByText(/35% complete/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Prerequisite skills' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Suggested learning activities' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'View module' }))

    const dialog = await screen.findByRole('dialog')
    expect(
      await within(dialog).findByRole('heading', { name: 'Relational Databases' }),
    ).toBeInTheDocument()

    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('opens the AI Coach with skill context from a skill detail', async () => {
    const user = await openSkillographyTab()

    await user.click(await screen.findByRole('button', { name: /SQL joins/ }))
    await screen.findByRole('heading', { level: 3, name: 'SQL joins' })

    await user.click(screen.getByRole('button', { name: 'Explore with AI Coach' }))

    const dialog = await screen.findByRole('dialog', { name: 'AI Coach' })
    expect(await within(dialog).findByRole('heading', { name: 'Skill context' })).toBeInTheDocument()
    expect(within(dialog).getByText('Context: SQL joins')).toBeInTheDocument()
  })

  it('uses the selected skill for AI Coach activities and related modules', async () => {
    const user = await openSkillographyTab()

    await user.type(await screen.findByLabelText('Search skills'), 'Transformer')
    await user.click(await screen.findByRole('button', { name: /Transformer models/ }))
    await screen.findByRole('heading', { level: 3, name: 'Transformer models' })

    await user.click(screen.getByRole('button', { name: 'Explore with AI Coach' }))

    const dialog = await screen.findByRole('dialog', { name: 'AI Coach' })
    expect(await within(dialog).findByText('Context: Transformer models')).toBeInTheDocument()
    expect(
      within(dialog).getByRole('button', { name: 'Open DL for NLP' }),
    ).toBeInTheDocument()
  })

  it('explores career pathways with coverage, missing competencies and projects', async () => {
    const user = await openSkillographyTab()

    await user.click(screen.getByRole('tab', { name: 'Career Path Explorer' }))
    await user.click(await screen.findByRole('button', { name: /Junior Data Analyst/ }))

    expect(screen.getAllByRole('heading', { name: 'Junior Data Analyst' }).length).toBeGreaterThan(1)
    expect(screen.getAllByText(/curriculum coverage · estimated/i).length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { name: 'Related skills' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Missing competencies' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Suggested projects' })).toBeInTheDocument()
    expect(screen.getByText(/not a job-readiness score/i)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Explore this pathway with AI Coach' }),
    ).toBeInTheDocument()
  })

  it('opens the AI Coach with career context from a pathway', async () => {
    const user = await openSkillographyTab()

    await user.click(screen.getByRole('tab', { name: 'Career Path Explorer' }))
    await user.click(await screen.findByRole('button', { name: /Junior Data Analyst/ }))
    await user.click(screen.getByRole('button', { name: 'Explore this pathway with AI Coach' }))

    const dialog = await screen.findByRole('dialog', { name: 'AI Coach' })
    expect(
      await within(dialog).findByRole('heading', { name: 'Career pathway context' }),
    ).toBeInTheDocument()
    expect(within(dialog).getByText('Junior Data Analyst', { selector: 'strong' })).toBeInTheDocument()
    expect(
      within(dialog).getByRole('button', { name: 'Open Data Visualization Tools' }),
    ).toBeInTheDocument()
    expect(within(dialog).getAllByText(/SQL joins/).length).toBeGreaterThan(0)
  })

  it('shows a retryable error without breaking the dashboard', async () => {
    const user = userEvent.setup()
    let calls = 0

    server.use(
      http.get('*/api/v1/me/skillography', () => {
        calls += 1
        if (calls === 1) {
          return HttpResponse.json(
            { error: 'server_error', message: 'Skill insights are unavailable.' },
            { status: 500 },
          )
        }
        return HttpResponse.json(MOCK_SKILLOGRAPHY)
      }),
    )

    renderApp()
    await screen.findByRole('heading', { name: /my learning dashboard/i })
    await user.click(screen.getByRole('tab', { name: 'Skillography' }))

    expect(
      await screen.findByRole('heading', { name: /could not load your skill insights/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('Skill insights are unavailable.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('button', { name: /SQL joins/ })).toBeInTheDocument()
  })
})
