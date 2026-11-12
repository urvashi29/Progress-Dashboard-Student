import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { PageError, PageLoading } from '../components/feedback/AsyncState'
import { useAuth } from './AuthContext'

export function ProtectedRoute() {
  const { status, error, refresh } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return <PageLoading label="Checking your session..." />
  }

  if (status === 'error') {
    return (
      <PageError
        title="We could not verify your session"
        message={error?.message ?? 'Please check your connection and try again.'}
        actionLabel="Try again"
        onAction={() => void refresh()}
      />
    )
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
