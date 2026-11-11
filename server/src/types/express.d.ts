import 'express-session'
import type { AuthContext, AuthRole } from '../auth/types'

declare module 'express-session' {
  interface SessionData {
    studentId?: number
    email?: string
    role?: AuthRole
    csrfToken?: string
  }
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext
    }
  }
}

export {}
