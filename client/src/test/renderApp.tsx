import { render, type RenderResult } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'
import { AuthProvider } from '../auth/AuthContext'
import { setMockSession } from '../mocks/state'

type RenderAppOptions = {
  route?: string
  authenticated?: boolean
}

export function renderApp({
  route = '/dashboard',
  authenticated = true,
}: RenderAppOptions = {}): RenderResult {
  setMockSession(authenticated)

  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  )
}
