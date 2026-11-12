import type { Tone } from '../../lib/status'

type StatusBadgeProps = {
  label: string
  tone?: Tone
}

export function StatusBadge({ label, tone = 'neutral' }: StatusBadgeProps) {
  return <span className={`badge badge--${tone}`}>{label}</span>
}
