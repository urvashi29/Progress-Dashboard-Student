import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderApp } from '../../test/renderApp'

async function renderSkillography() {
  renderApp()
  const section = await screen.findByRole('region', { name: /skillography.*career pathways/i })
  await within(section).findByRole('heading', { name: 'Career Path Explorer' })
  expect(within(section).getByText(/module completion is not proficiency/i)).toBeInTheDocument()
  return section
}

describe('skillography dashboard section', () => {
  it('separates module completion, estimated exposure, and unavailable proficiency', async () => {
    const section = await renderSkillography()

    expect(within(section).getByText('Estimated, not assessed')).toBeInTheDocument()
    expect(
      within(section).getByText(/verified skill proficiency is unavailable/i),
    ).toBeInTheDocument()
    expect(
      within(section).getAllByText(/estimated skill exposure/i).length,
    ).toBeGreaterThan(0)
    expect(within(section).getAllByText(/low confidence/i).length).toBeGreaterThan(0)
    expect(
      within(section).getAllByText(/module completion does not confirm proficiency/i).length,
    ).toBeGreaterThan(0)
  })

  it('groups skills by the four approved learning tracks', async () => {
    const section = await renderSkillography()
    const skillsByTrack = within(section).getByRole('region', {
      name: /skills by learning track/i,
    })
    const trackNames = within(skillsByTrack)
      .getAllByRole('article')
      .map((article) => within(article).getByRole('heading', { level: 3 }).textContent)

    expect(trackNames).toEqual([
      'Foundations',
      'Data & Analytics',
      'AI & ML',
      'Production & Industry',
    ])
    expect(within(skillsByTrack).getAllByText(/in plan/i).length).toBeGreaterThan(0)
  })

  it('shows practice areas and a module-to-skill relationship table', async () => {
    const section = await renderSkillography()

    expect(
      within(section).getByRole('heading', { name: /areas for additional practice/i }),
    ).toBeInTheDocument()
    expect(
      within(section).getByRole('table', { name: /module to skill mapping data/i }),
    ).toBeInTheDocument()
    const table = within(section).getByRole('table', {
      name: /module to skill mapping data/i,
    })
    expect(within(table).getAllByRole('row').length).toBeGreaterThan(13)
    expect(within(table).getAllByText(/not included in your current plan|complete/i).length)
      .toBeGreaterThan(0)
  })

  it('explores all career pathways with required and missing skills', async () => {
    const section = await renderSkillography()

    expect(
      within(section).getByRole('heading', { name: 'Career Path Explorer' }),
    ).toBeInTheDocument()

    for (const title of [
      'Junior Python Developer',
      'Junior Data Analyst',
      'Junior Machine Learning Engineer',
      'MLOps / ML Platform Associate',
      'Junior AI Application Developer',
    ]) {
      const card = within(section).getByRole('article', { name: title })
      expect(within(card).getByText('Required skills')).toBeInTheDocument()
      expect(within(card).getByText('Missing skills and next steps')).toBeInTheDocument()
      expect(within(card).getAllByText(/estimated exposure/i).length).toBeGreaterThan(0)
    }

    const pythonCard = within(section).getByRole('article', {
      name: 'Junior Python Developer',
    })
    expect(within(pythonCard).getAllByText(/curriculum coverage/i).length).toBeGreaterThan(0)
    expect(within(pythonCard).getByText(/not a job-readiness score/i)).toBeInTheDocument()
    expect(within(pythonCard).getByText(/not a guarantee of employment/i)).toBeInTheDocument()
    expect(
      within(pythonCard).getByText(/not a statement that you are job-ready/i),
    ).toBeInTheDocument()
    expect(screen.queryByText(/you qualify for this position/i)).not.toBeInTheDocument()
  })

  it('shows a retryable error without breaking the rest of the dashboard', async () => {
    const { server } = await import('../../test/server')
    const { HttpResponse, http } = await import('msw')

    server.use(
      http.get('*/api/v1/me/skillography', () =>
        HttpResponse.json(
          { error: 'service_unavailable', message: 'Skill insights are unavailable.' },
          { status: 503 },
        ),
      ),
    )

    renderApp()
    await screen.findByRole('heading', { name: /your learning progress/i })

    expect(
      await screen.findByRole('heading', { name: /could not load your skill insights/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Your modules' })).toBeInTheDocument()
  })
})
