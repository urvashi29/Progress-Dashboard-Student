import { randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { env } from '../config/env'

/**
 * A fixed bcrypt hash used only to equalize timing when an email is unknown.
 * It is not a real account password and is never matched against stored data.
 */
const DUMMY_HASH = '$2b$12$FPEu0Lmz1AQKY2m/9I6pvO8juOrNdWLKA3ri/EGzxeUw7OS2kPDYm'
// Lower-cost equivalent for tests so the timing mitigation does not dominate
// the suite runtime. Production always uses the cost-12 hash above.
const DUMMY_HASH_TEST = '$2b$04$22htTGDNNXPRRM/CsAYbWO34dwB2aG.VdrYEVK3azOWkJavRYc7w2'

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, env.BCRYPT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

/** Keeps login timing similar whether or not the email exists. */
export async function verifyDummyPassword(password: string): Promise<void> {
  await bcrypt.compare(password, env.NODE_ENV === 'test' ? DUMMY_HASH_TEST : DUMMY_HASH)
}

/**
 * Local-demo provisioning only. Production should use an invitation/reset flow
 * instead of generating and writing plaintext passwords to a CSV.
 */
export function generateTemporaryPassword(): string {
  return `Spd-${randomBytes(12).toString('base64url')}-9!`
}

export function demoPasswordIfConfigured(): string | undefined {
  return env.DEMO_DEFAULT_PASSWORD
}
