import { MOCK_STUDENTS, normalizeEmail } from '@spd/shared'
import { hashPassword } from '../auth/passwords'
import { env } from '../config/env'
import { db } from './client'

/**
 * Local-demo provisioning only. Sets a bcrypt password on a fictional seeded
 * student so login can be exercised without importing any real workbook.
 *
 * The account uses the reserved example.com domain and never touches imported
 * student data. Production is refused outright.
 */
const LOCAL_DEMO_PASSWORD = 'demo1234'

async function main(): Promise<void> {
  if (env.NODE_ENV === 'production') {
    throw new Error('Refusing to provision a demo account in production')
  }

  const demo = MOCK_STUDENTS[0]
  if (!demo) throw new Error('No fictional student fixture is defined')
  const email = normalizeEmail(demo.email)

  const row = await db('students').where({ email }).first<{ id: number }>('id')
  if (!row) {
    throw new Error(
      `Demo student ${email} was not found. Run "npm run db:migrate" and "npm run db:seed" first.`,
    )
  }

  const password = env.DEMO_DEFAULT_PASSWORD ?? LOCAL_DEMO_PASSWORD
  const passwordHash = await hashPassword(password)

  await db('students').where({ id: row.id }).update({
    password_hash: passwordHash,
    must_change_password: false,
    role: 'student',
  })

  console.log(`[db] Local demo account ready: ${email}`)
  console.log(
    `[db] Password source: ${
      env.DEMO_DEFAULT_PASSWORD ? 'DEMO_DEFAULT_PASSWORD' : 'local demo default'
    } (not printed)`,
  )
  console.log('[db] Fictional data only. Never provision a demo account against production.')
}

void main()
  .catch((error: unknown) => {
    console.error('[db] Demo account setup failed', error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(() => {
    void db.destroy()
  })
