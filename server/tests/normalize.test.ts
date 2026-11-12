import { findModuleByName } from '@spd/shared'
import { describe, expect, it } from 'vitest'
import {
  FIXED_HEADERS,
  MODULE_HEADERS,
  parseBoundedPercent,
  toIsoDate,
} from '../src/ingestion/normalize'

describe('Excel date normalization', () => {
  it('converts Excel serial dates using the 1900 date system', () => {
    expect(toIsoDate(45657)).toBe('2024-12-31')
    expect(toIsoDate('45659')).toBe('2025-01-02')
    expect(toIsoDate(45627)).toBe('2024-12-01')
  })

  it('accepts Date values and ISO strings', () => {
    expect(toIsoDate(new Date('2025-03-01T00:00:00.000Z'))).toBe('2025-03-01')
    expect(toIsoDate('2025-03-01')).toBe('2025-03-01')
    expect(toIsoDate('2025-03-01T10:30:00.000Z')).toBe('2025-03-01')
  })

  it('rejects invalid, impossible, and out-of-range dates', () => {
    expect(toIsoDate('not-a-date')).toBeUndefined()
    expect(toIsoDate(0)).toBeUndefined()
    expect(toIsoDate('2025-02-30')).toBeUndefined()
    expect(toIsoDate('1899-12-31')).toBeUndefined()
    expect(toIsoDate(null)).toBeUndefined()
  })
})

describe('progress normalization', () => {
  it('accepts numeric values from 0 to 100', () => {
    expect(parseBoundedPercent(0)).toEqual({ ok: true, value: 0 })
    expect(parseBoundedPercent('100')).toEqual({ ok: true, value: 100 })
    expect(parseBoundedPercent(42.5)).toEqual({ ok: true, value: 42.5 })
  })

  it('classifies missing, non-numeric, and out-of-range values', () => {
    expect(parseBoundedPercent(null)).toMatchObject({ ok: false, reason: 'missing' })
    expect(parseBoundedPercent('abc')).toMatchObject({ ok: false, reason: 'not_numeric' })
    expect(parseBoundedPercent(101)).toMatchObject({ ok: false, reason: 'out_of_range' })
    expect(parseBoundedPercent(-1)).toMatchObject({ ok: false, reason: 'out_of_range' })
  })
})

describe('spreadsheet header specification', () => {
  it('defines 14 fixed fields and 13 name/progress pairs', () => {
    expect(FIXED_HEADERS).toHaveLength(14)
    expect(MODULE_HEADERS).toHaveLength(13)
  })
})

describe('name-based module identity', () => {
  const sourceNames: Array<[string, string]> = [
    ['Introduction to Computer Programming', 'intro-to-computer-programming'],
    ['Numerical Programming in Python', 'numerical-programming-in-python'],
    ['Relational Databases', 'relational-databases'],
    ['Data Visualization Tools', 'data-visualization-tools'],
    ['Applied Business Analytics', 'applied-business-analytics'],
    ['Advanced Machine Learning', 'advanced-machine-learning'],
    ['Introduction to Deep Learning', 'intro-to-deep-learning'],
    ['Deep Learning for Computer Vision', 'dl-for-computer-vision'],
    ['Deep Learning for NLP', 'dl-for-nlp'],
    ['Distributed Machine Learning', 'distributed-ml'],
    ['Machine Learning & Generative AI with Microsoft Azure', 'ml-genai-with-microsoft-azure'],
    ['Productionization of ML Systems', 'productionization-of-ml-systems'],
    ['Industry Immersion', 'industry-immersion'],
  ]

  it('resolves every real spreadsheet label regardless of slot position', () => {
    for (const [name, slug] of sourceNames) {
      expect(findModuleByName(name)?.slug).toBe(slug)
    }
  })

  it('normalizes case and whitespace', () => {
    expect(findModuleByName('  relational   DATABASES ' )?.slug).toBe('relational-databases')
  })
})
