import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <main className="page-status state-panel">
      <h1>Page not found</h1>
      <p>The page you opened does not exist in this dashboard.</p>
      <div className="state-panel__actions">
        <Link className="btn btn--primary" to="/dashboard">
          Go to dashboard
        </Link>
      </div>
    </main>
  )
}
