import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { DEMO_EMAIL, DEMO_PASSWORD } from '../lib/demo'
import { renderApp } from '../test/renderApp'
import { server } from '../test/server'

describe('login and protected routes', () => {
  it('redirects unauthenticated visitors from the dashboard to login', async () => {
    renderApp({ route: '/dashboard', authenticated: false })

    expect(
      await screen.findByRole('heading', { name: /sign in to your progress dashboard/i }),
    ).toBeInTheDocument()
  })

  it('signs in with demo credentials and opens the dashboard', async () => {
    const user = userEvent.setup()
    renderApp({ route: '/dashboard', authenticated: false })

    await user.type(await screen.findByLabelText('Email'), DEMO_EMAIL)
    await user.type(screen.getByLabelText('Password'), DEMO_PASSWORD)
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(
      await screen.findByRole('heading', { name: /my learning dashboard/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('Welcome back, Aanya.')).toBeInTheDocument()
  })

  it('shows a readable error for invalid credentials', async () => {
    const user = userEvent.setup()
    renderApp({ route: '/dashboard', authenticated: false })

    await user.type(await screen.findByLabelText('Email'), DEMO_EMAIL)
    await user.type(screen.getByLabelText('Password'), 'not-the-password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText(/email or password is incorrect/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
  })

  it('redirects an authenticated student away from the login page', async () => {
    renderApp({ route: '/login', authenticated: true })

    expect(
      await screen.findByRole('heading', { name: /my learning dashboard/i }),
    ).toBeInTheDocument()
  })

  it('shows a session verification error with a retry action', async () => {
    server.use(
      http.get('*/api/v1/auth/me', () =>
        HttpResponse.json({ error: 'server_error', message: 'Session check failed.' }, { status: 500 }),
      ),
    )

    renderApp({ route: '/dashboard', authenticated: true })

    expect(
      await screen.findByRole('heading', { name: /we could not verify your session/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })
})
