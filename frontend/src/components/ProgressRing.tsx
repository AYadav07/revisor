import { cn } from 'cn'

/**
 * A small circular progress mark, for places a bar won't fit (e.g. inside a button, where a
 * block-level progress bar isn't valid HTML). Decorative: always paired with a visible count.
 */
export function ProgressRing({ value, className }: { value: number; className?: string }) {
  const radius = 6
  const circumference = 2 * Math.PI * radius
  const clamped = Math.min(100, Math.max(0, value))
  return (
    <svg aria-hidden viewBox="0 0 16 16" className={cn('size-4 shrink-0 -rotate-90', className)}>
      <circle cx="8" cy="8" r={radius} fill="none" strokeWidth="2.5" className="stroke-muted" />
      {clamped > 0 && (
        <circle
          cx="8"
          cy="8"
          r={radius}
          fill="none"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped / 100)}
          className="stroke-success"
        />
      )}
    </svg>
  )
}
