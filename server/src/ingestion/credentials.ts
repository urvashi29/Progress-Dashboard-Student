import fs from 'node:fs'
import path from 'node:path'
import { privateDataDir } from '../config/env'

export type ProvisionedCredential = {
  email: string
  password: string
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true })
}

function csvEscape(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

export function credentialsCsvPath(): string {
  return path.join(privateDataDir, 'credentials.csv')
}

/**
 * Local-demo only. Appends plaintext credentials exactly once per new account.
 * The file lives under the gitignored private data directory and is never
 * returned by the API or written to logs.
 */
export function appendCredentials(entries: ProvisionedCredential[]): string | undefined {
  if (entries.length === 0) return undefined

  ensureDir(privateDataDir)
  const file = credentialsCsvPath()
  const isNew = !fs.existsSync(file) || fs.statSync(file).size === 0
  const createdAt = new Date().toISOString()

  const lines = entries.map(
    (entry) => `${csvEscape(entry.email)},${csvEscape(entry.password)},${createdAt}`,
  )
  const payload = `${isNew ? 'email,password,created_at\n' : ''}${lines.join('\n')}\n`

  fs.appendFileSync(file, payload, { encoding: 'utf8', mode: 0o600 })
  return file
}

/**
 * Archives the uploaded workbook under the approved gitignored directory. The
 * stored name is derived from the content hash and a sanitized basename, so a
 * crafted filename cannot escape the directory.
 */
export function archiveImportFile(
  buffer: Buffer,
  originalName: string,
  fileHash: string,
): string {
  const importsDir = path.join(privateDataDir, 'imports')
  ensureDir(importsDir)

  const base = path
    .basename(originalName || 'import.xlsx')
    .replace(/[^A-Za-z0-9._-]/g, '_')
    .replace(/^\.+/, '')
  const safeBase = base.toLowerCase().endsWith('.xlsx') ? base : `${base}.xlsx`
  const filename = `${fileHash.slice(0, 16)}-${safeBase || 'import.xlsx'}`
  const target = path.resolve(importsDir, filename)

  if (!target.startsWith(`${path.resolve(importsDir)}${path.sep}`)) {
    throw new Error('Refusing to write outside the private imports directory')
  }

  fs.writeFileSync(target, buffer, { mode: 0o600 })
  return target
}

/** Test/admin helper: removes generated credentials for a fresh local demo. */
export function credentialsCsvExists(): boolean {
  return fs.existsSync(credentialsCsvPath())
}
