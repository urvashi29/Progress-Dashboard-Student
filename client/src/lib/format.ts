export function formatPercent(value: number): string {
  const rounded = Math.round(value * 10) / 10
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}%`
}

export function formatRatio(ratio: number): string {
  const rounded = Math.round(ratio * 100) / 100
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(2)}x`
}

export function formatIsoDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return isoDate
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' }).format(date)
}

export function firstName(name: string): string {
  const [first] = name.trim().split(/\s+/)
  return first ?? name
}

export function formatDaysAgo(days: number): string {
  if (days === 0) return 'today'
  if (days === 1) return '1 day ago'
  return `${days} days ago`
}
