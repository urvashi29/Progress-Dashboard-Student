import type { Tone } from '../../lib/status'

type ProgressBarProps = {
  value: number
  label: string
  tone?: Tone
  size?: 'sm' | 'md' | 'lg'
}

export function ProgressBar({ value, label, tone = 'info', size = 'md' }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value))

  return (
    <div
      className={`progress progress--${size} progress--${tone}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
    >
      <span className="progress__fill" style={{ width: `${clamped}%` }} />
    </div>
  )
}
