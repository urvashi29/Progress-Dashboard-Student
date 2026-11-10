import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('Phase 0 shell', () => {
  it('renders the foundation status and all four catalog tracks', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', { name: /student progress dashboard/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/phase 0/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Foundations' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Data & Analytics' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'AI & ML' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Production & Industry' })).toBeInTheDocument()
  })

  it('shows only fictional mock identities', () => {
    render(<App />)

    expect(screen.getByText(/fictional data only/i)).toBeInTheDocument()
    expect(screen.getByText('aanya.fictional@example.com')).toBeInTheDocument()
    expect(screen.queryByText(/@gmail\.com/i)).not.toBeInTheDocument()
  })
})
