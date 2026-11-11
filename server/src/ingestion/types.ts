export type SkippedReason =
  | 'empty_row'
  | 'non_data_science'
  | 'invalid_email'
  | 'validation_failed'

export type SkippedRow = {
  row: number
  reason: SkippedReason
  detail?: string
}

export type ImportWarningCode =
  | 'duplicate_email'
  | 'unknown_module'
  | 'missing_overall_progress'
  | 'invalid_overall_progress'
  | 'invalid_optional_date'
  | 'orphan_module_progress'
  | 'duplicate_module_in_row'
  | 'unexpected_header'
  | 'credentials_write_failed'

export type ImportWarning = {
  code: ImportWarningCode
  message: string
  row?: number
  field?: string
  rawValue?: string
  moduleName?: string
}

export type ValidationFailure = {
  row: number
  field: string
  message: string
  rawValue?: string
}

export type DuplicateEmailWarning = {
  emailMasked: string
  rows: number[]
}

export type UnknownModuleWarning = {
  row: number
  moduleName: string
}

export type ImportReport = {
  filename: string
  fileHash: string
  importedAt: string
  rowsTotal: number
  imported: number
  createdStudents: number
  updatedStudents: number
  createdEnrollments: number
  updatedEnrollments: number
  moduleProgressRows: number
  skippedTotal: number
  skippedByReason: Partial<Record<SkippedReason, number>>
  skippedRows: SkippedRow[]
  warnings: ImportWarning[]
  duplicateEmails: DuplicateEmailWarning[]
  unknownModules: UnknownModuleWarning[]
  validationFailures: ValidationFailure[]
  unexpectedHeaders: string[]
  alreadyImported?: boolean
}

export type ImportSummary = {
  id: number
  filename: string
  fileHash: string
  rowsTotal: number
  imported: number
  skipped: number
  createdAt: string
}
