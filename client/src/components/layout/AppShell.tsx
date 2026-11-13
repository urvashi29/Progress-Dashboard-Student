import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { Button } from '../ui/Button'

function navLinkClass({ isActive }: { isActive: boolean }) {
  return isActive ? 'nav-link is-active' : 'nav-link'
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

export function AppShell() {
  const { student, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!menuOpen) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [menuOpen])

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      <button
        type="button"
        className={`sidebar-overlay${menuOpen ? ' is-open' : ''}`}
        aria-label="Close navigation"
        tabIndex={menuOpen ? 0 : -1}
        onClick={() => setMenuOpen(false)}
      />

      <aside
        id="primary-sidebar"
        className={`sidebar${menuOpen ? ' is-open' : ''}`}
        aria-label="Primary"
      >
        <div className="sidebar__brand">
          <span className="brand-mark" aria-hidden="true">
            PD
          </span>
          <span className="brand-text">
            <strong>Learning Path</strong>
            <span>Student workspace</span>
          </span>
          <button
            type="button"
            className="sidebar__close"
            aria-label="Close navigation"
            onClick={() => setMenuOpen(false)}
          >
            Close
          </button>
        </div>

        <nav className="sidebar__nav" aria-label="Main">
          <NavLink to="/dashboard" className={navLinkClass}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 13a9 9 0 1 0 9-9" />
              <path d="M12 12l4-4" />
              <path d="M12 3v3" />
              <path d="M3 12h3" />
            </svg>
            Progress Dashboard
          </NavLink>
        </nav>

        <div className="sidebar__footer">
          <p className="sidebar__student">
            <span className="avatar" aria-hidden="true">
              {student ? initials(student.name) : ''}
            </span>
            <span className="sidebar__student-name">{student?.name}</span>
          </p>
          <Button variant="ghost" onClick={() => void handleLogout()}>
            Log out
          </Button>
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar" aria-label="Application header">
          <button
            type="button"
            className="menu-toggle"
            aria-label="Menu"
            aria-expanded={menuOpen}
            aria-controls="primary-sidebar"
            onClick={() => setMenuOpen(true)}
          >
            Menu
          </button>
          <span className="topbar__brand">Progress Dashboard</span>
          <span className="topbar__student">{student?.name}</span>
          <Button
            variant="ghost"
            className="topbar__logout"
            aria-label="Log out of your account"
            onClick={() => void handleLogout()}
          >
            Log out
          </Button>
        </header>

        <main id="main-content" className="content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
