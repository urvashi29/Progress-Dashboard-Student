import { formatPercent } from '../../lib/format'

type ProgressRingProps = {
  value: number
  label: string
  size?: number
}

export function ProgressRing({ value, label, size = 148 }: ProgressRingProps) {
  const clamped = Math.min(100, Math.max(0, value))
  const stroke = 11
  const radius = (size - stroke) / 2
  const center = size / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - clamped / 100)

  return (
    <div className="progress-ring" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true" focusable="false">
        <circle
          className="progress-ring__track"
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={stroke}
        />
        <circle
          className="progress-ring__value"
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </svg>
      <span className="progress-ring__content">
        <span className="progress-ring__value-text">{formatPercent(clamped)}</span>
        <span className="progress-ring__caption">{label}</span>
      </span>
    </div>
  )
}
