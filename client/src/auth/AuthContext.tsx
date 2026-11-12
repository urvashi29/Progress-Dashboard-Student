import type { StudentProfile } from '@spd/shared'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { fetchSession, loginRequest, logoutRequest } from '../api/auth'
import { toApiError, type ApiError } from '../api/client'

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'error'

type AuthState = {
  status: AuthStatus
  student: StudentProfile | null
  error: ApiError | null
}

type AuthContextValue = AuthState & {
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const INITIAL_STATE: AuthState = { status: 'loading', student: null, error: null }

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(INITIAL_STATE)

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, status: 'loading', error: null }))
    try {
      const student = await fetchSession()
      setState(
        student
          ? { status: 'authenticated', student, error: null }
          : { status: 'unauthenticated', student: null, error: null },
      )
    } catch (error) {
      setState({ status: 'error', student: null, error: toApiError(error) })
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const login = useCallback(async (email: string, password: string) => {
    const student = await loginRequest(email, password)
    setState({ status: 'authenticated', student, error: null })
  }, [])

  const logout = useCallback(async () => {
    try {
      await logoutRequest()
    } catch {
      setState({ status: 'unauthenticated', student: null, error: null })
      return
    }
    setState({ status: 'unauthenticated', student: null, error: null })
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, login, logout, refresh }),
    [state, login, logout, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside an AuthProvider')
  return context
}
