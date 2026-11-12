import ExcelJS from 'exceljs'
import { HttpError } from '../http/errors'
import {
  cleanText,
  isBlank,
  normalizeHeader,
  REQUIRED_HEADERS,
} from './normalize'

export type ParsedRow = {
  /** Spreadsheet row number (header is row 1). */
  row: number
  allBlank: boolean
  values: Map<string, unknown>
}

export type ParsedWorkbook = {
  sheetName: string
  rowsTotal: number
  rows: ParsedRow[]
  unexpectedHeaders: string[]
}

function primitiveCellValue(value: ExcelJS.CellValue): unknown {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return value
  if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'object') {
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join('')
    }
    if ('formula' in value || 'sharedFormula' in value) {
      const result = (value as { result?: unknown }).result
      return result === undefined ? null : primitiveCellValue(result as ExcelJS.CellValue)
    }
    if ('error' in value) return null
    if ('text' in value) return String((value as { text: unknown }).text)
  }
  return String(value)
}

const MAX_ROWS = 50_000

/**
 * Reads the first worksheet and maps every required header to its cell value.
 * Module columns are read as data only; module identity is resolved by name.
 */
export async function parseWorkbook(buffer: Buffer): Promise<ParsedWorkbook> {
  const workbook = new ExcelJS.Workbook()

  try {
    // ExcelJS's bundled type declares its own Buffer shape; the runtime value
    // is a normal Node Buffer.
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer)
  } catch {
    throw new HttpError(400, 'invalid_spreadsheet', 'File is not a readable .xlsx workbook')
  }

  const sheet = workbook.worksheets[0]
  if (!sheet) {
    throw new HttpError(400, 'invalid_spreadsheet', 'Workbook has no worksheets')
  }

  if (sheet.rowCount - 1 > MAX_ROWS) {
    throw new HttpError(400, 'too_many_rows')
  }

  const headerRow = sheet.getRow(1)
  const headersByIndex = new Map<number, string>()
  const headerIndex = new Map<string, number>()

  for (let column = 1; column <= headerRow.cellCount; column += 1) {
    const raw = cleanText(primitiveCellValue(headerRow.getCell(column).value))
    if (!raw) continue
    const normalized = normalizeHeader(raw)
    if (headerIndex.has(normalized)) continue
    headerIndex.set(normalized, column)
    headersByIndex.set(column, raw)
  }

  const requiredSet = new Set<string>(REQUIRED_HEADERS.map((header) => normalizeHeader(header)))
  const missingHeaders = REQUIRED_HEADERS.filter(
    (header) => !headerIndex.has(normalizeHeader(header)),
  )

  if (missingHeaders.length > 0) {
    throw new HttpError(400, 'invalid_spreadsheet', 'Missing required columns', {
      missingHeaders,
    })
  }

  const unexpectedHeaders = [...headersByIndex.values()].filter(
    (header) => !requiredSet.has(normalizeHeader(header)),
  )

  const rows: ParsedRow[] = []
  const lastRow = sheet.rowCount

  for (let rowNumber = 2; rowNumber <= lastRow; rowNumber += 1) {
    const row = sheet.getRow(rowNumber)
    const values = new Map<string, unknown>()
    let allBlank = true

    for (const header of REQUIRED_HEADERS) {
      const column = headerIndex.get(normalizeHeader(header))
      const value = column ? primitiveCellValue(row.getCell(column).value) : null
      values.set(header, value)
      if (!isBlank(value)) allBlank = false
    }

    // Detect stray values in unexpected columns so they are never dropped
    // silently; the header list is surfaced in the import report instead.
    if (unexpectedHeaders.length > 0) {
      for (let column = 1; column <= row.cellCount; column += 1) {
        if (!headersByIndex.has(column)) continue
        const value = primitiveCellValue(row.getCell(column).value)
        if (!isBlank(value)) allBlank = false
      }
    }

    rows.push({ row: rowNumber, allBlank, values })
  }

  return {
    sheetName: sheet.name,
    rowsTotal: Math.max(0, lastRow - 1),
    rows,
    unexpectedHeaders,
  }
}
