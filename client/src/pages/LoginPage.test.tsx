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

  it('does not show a session-expired error on an initial unauthenticated visit', async () => {
    renderApp({ route: '/dashboard', authenticated: false })

    expect(
      await screen.findByRole('heading', { name: /sign in to your progress dashboard/i }),
    ).toBeInTheDocument()
    expect(screen.queryByText(/your session has expired/i)).not.toBeInTheDocument()
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

  it('does not show session-expired for credentials rejected without a message', async () => {
    server.use(
      http.post('*/api/v1/auth/login', () =>
        HttpResponse.json({ error: 'invalid_credentials' }, { status: 401 }),
      ),
    )

    const user = userEvent.setup()
    renderApp({ route: '/dashboard', authenticated: false })

    await user.type(await screen.findByLabelText('Email'), DEMO_EMAIL)
    await user.type(screen.getByLabelText('Password'), 'not-the-password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Email or password is incorrect.')).toBeInTheDocument()
    expect(screen.queryByText(/your session has expired/i)).not.toBeInTheDocument()
  })

  it('shows a server error instead of session-expired when login fails', async () => {
    server.use(
      http.post('*/api/v1/auth/login', () =>
        HttpResponse.json({ error: 'internal_error' }, { status: 500 }),
      ),
    )

    const user = userEvent.setup()
    renderApp({ route: '/dashboard', authenticated: false })

    await user.type(await screen.findByLabelText('Email'), DEMO_EMAIL)
    await user.type(screen.getByLabelText('Password'), DEMO_PASSWORD)
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(
      await screen.findByText(/something went wrong on our side/i),
    ).toBeInTheDocument()
    expect(screen.queryByText(/your session has expired/i)).not.toBeInTheDocument()
  })

  it('shows a CSRF error instead of session-expired when the token is rejected', async () => {
    server.use(
      http.post('*/api/v1/auth/login', () =>
        HttpResponse.json({ error: 'invalid_csrf_token' }, { status: 403 }),
      ),
    )

    const user = userEvent.setup()
    renderApp({ route: '/dashboard', authenticated: false })

    await user.type(await screen.findByLabelText('Email'), DEMO_EMAIL)
    await user.type(screen.getByLabelText('Password'), DEMO_PASSWORD)
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(
      await screen.findByText(/your security token expired/i),
    ).toBeInTheDocument()
    expect(screen.queryByText(/your session has expired/i)).not.toBeInTheDocument()
  })

  it('shows a network error instead of session-expired when the server is unreachable', async () => {
    server.use(http.post('*/api/v1/auth/login', () => HttpResponse.error()))

    const user = userEvent.setup()
    renderApp({ route: '/dashboard', authenticated: false })

    await user.type(await screen.findByLabelText('Email'), DEMO_EMAIL)
    await user.type(screen.getByLabelText('Password'), DEMO_PASSWORD)
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText(/unable to reach the server/i)).toBeInTheDocument()
    expect(screen.queryByText(/your session has expired/i)).not.toBeInTheDocument()
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
