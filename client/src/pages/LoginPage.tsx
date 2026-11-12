import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ApiError } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { Button } from '../components/ui/Button'
import { DEMO_EMAIL, DEMO_PASSWORD, MOCKS_ENABLED } from '../lib/demo'

function safeRedirect(from: unknown): string {
  return typeof from === 'string' && from.startsWith('/') ? from : '/dashboard'
}

export function LoginPage() {
  const { status, student, error: authError, login } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const redirectTo = safeRedirect((location.state as { from?: unknown } | null)?.from)

  if (status === 'authenticated' && student) {
    return <Navigate to={redirectTo} replace />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(email.trim(), password)
      navigate(redirectTo, { replace: true })
    } catch (loginError) {
      setError(
        loginError instanceof ApiError
          ? loginError.message
          : 'We could not sign you in. Please try again.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-heading">
        <p className="eyebrow">Learning Path</p>
        <h1 id="login-heading">Sign in to your progress dashboard</h1>
        <p className="muted">
          Use the student account provided by your program team to see your course completion and
          learning health.
        </p>

        {status === 'error' ? (
          <p className="form-error" role="status">
            We could not check an existing session{authError ? `: ${authError.message}` : '.'} You
            can still try signing in.
          </p>
        ) : null}

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              aria-invalid={error ? true : undefined}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              aria-invalid={error ? true : undefined}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}

          <Button type="submit" disabled={submitting} className="login-form__submit">
            {submitting ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>

        {MOCKS_ENABLED ? (
          <aside className="login-hint" aria-label="Demo credentials">
            <h2>Demo mode</h2>
            <p>
              Email: <code>{DEMO_EMAIL}</code>
            </p>
            <p>
              Password: <code>{DEMO_PASSWORD}</code>
            </p>
            <p className="muted">
              Mock API only. This is a development preview, not production authentication.
            </p>
          </aside>
        ) : null}
      </section>

      <aside className="login-aside" aria-label="About this dashboard">
        <h2>Know where you stand and what to do next</h2>
        <ul>
          <li>See your authoritative course completion at a glance.</li>
          <li>Understand your learning pace with clear, non-technical explanations.</li>
          <li>Find the modules that deserve your attention next.</li>
        </ul>
        <p className="login-aside__note">
          Skills and recommendations are estimated from module progress, never presented as
          measured proficiency.
        </p>
      </aside>
    </main>
  )
}
