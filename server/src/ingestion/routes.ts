import { Router } from 'express'
import multer from 'multer'
import { env } from '../config/env'
import { db } from '../db/client'
import { requireAdmin, requireAuth } from '../auth/middleware'
import { requireCsrf } from '../auth/session'
import { asyncHandler, HttpError } from '../http/errors'
import { importWorkbook } from './import-service'
import type { ImportSummary } from './types'

const XLSX_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream',
  'application/zip',
])

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.IMPORT_MAX_FILE_BYTES,
    files: 1,
    fields: 4,
  },
  fileFilter: (_req, file, callback) => {
    const allowedName = file.originalname.toLowerCase().endsWith('.xlsx')
    const allowedType = XLSX_MIME_TYPES.has(file.mimetype)
    if (!allowedName || !allowedType) {
      callback(new HttpError(400, 'unsupported_file_type', 'Only .xlsx files are accepted'))
      return
    }
    callback(null, true)
  },
})

type ImportRow = {
  id: number
  filename: string
  file_hash: string
  rows_total: number
  imported: number
  skipped: number
  created_at: string
}

export function createAdminImportRouter(): Router {
  const router = Router()

  router.use(requireAuth, requireAdmin)

  router.post(
    '/import/excel',
    requireCsrf,
    upload.single('file'),
    asyncHandler(async (req, res) => {
      const file = req.file
      if (!file) {
        throw new HttpError(400, 'missing_file', 'Upload an .xlsx file in the "file" field')
      }

      // xlsx is a ZIP container; reject spoofed MIME/extension early.
      if (file.buffer.length < 4 || file.buffer[0] !== 0x50 || file.buffer[1] !== 0x4b) {
        throw new HttpError(400, 'invalid_file_signature', 'File is not a valid .xlsx workbook')
      }

      const report = await importWorkbook(file.buffer, file.originalname)
      res.status(report.alreadyImported ? 200 : 201).json(report)
    }),
  )

  router.get(
    '/imports',
    asyncHandler(async (req, res) => {
      const requested = Number(req.query.limit ?? 20)
      const limit = Number.isFinite(requested)
        ? Math.min(100, Math.max(1, Math.trunc(requested)))
        : 20

      const rows = await db('imports')
        .orderBy('id', 'desc')
        .limit(limit)
        .select<ImportRow[]>(
          'id',
          'filename',
          'file_hash',
          'rows_total',
          'imported',
          'skipped',
          'created_at',
        )

      const imports: ImportSummary[] = rows.map((row) => ({
        id: row.id,
        filename: row.filename,
        fileHash: row.file_hash,
        rowsTotal: row.rows_total,
        imported: row.imported,
        skipped: row.skipped,
        createdAt: row.created_at,
      }))

      res.json({ imports })
    }),
  )

  return router
}
