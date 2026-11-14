import type { RequestHandler } from 'express'
import { normalizeEmail } from '@spd/shared'
import { env } from '../config/env'
import { db } from '../db/client'
import { FORBIDDEN_MESSAGE, SESSION_EXPIRED_MESSAGE } from './messages'
import type { AuthContext, AuthRole } from './types'

type StudentAuthRow = {
  id: number
  name: string
  email: string
  role: AuthRole
  must_change_password: boolean | number
}

export function isAdminAuth(auth: Pick<AuthContext, 'role' | 'email'>): boolean {
  if (auth.role === 'admin') return true
  return Boolean(env.ADMIN_EMAIL && normalizeEmail(auth.email) === normalizeEmail(env.ADMIN_EMAIL))
}

/**
 * Loads the student from the database on every authenticated request so a
 * deleted account or a role change takes effect immediately.
 */
export const requireAuth: RequestHandler = (req, res, next) => {
  const studentId = req.session.studentId
  if (!studentId) {
    res.status(401).json({
      error: 'unauthorized',
      message: SESSION_EXPIRED_MESSAGE,
    })
    return
  }

  void db('students')
    .where({ id: studentId })
    .first<StudentAuthRow>('id', 'name', 'email', 'role', 'must_change_password')
    .then((row) => {
      if (!row) {
        req.session.destroy(() => {
          res.status(401).json({
            error: 'unauthorized',
            message: SESSION_EXPIRED_MESSAGE,
          })
        })
        return
      }

      req.auth = {
        studentId: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
        mustChangePassword: Boolean(row.must_change_password),
      }
      next()
    })
    .catch(next)
}

export const requireAdmin: RequestHandler = (req, res, next) => {
  if (!req.auth) {
    res.status(401).json({
      error: 'unauthorized',
      message: SESSION_EXPIRED_MESSAGE,
    })
    return
  }
  if (!isAdminAuth(req.auth)) {
    res.status(403).json({
      error: 'forbidden',
      message: FORBIDDEN_MESSAGE,
    })
    return
  }
  next()
}
