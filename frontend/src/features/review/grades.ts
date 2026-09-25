import type { Quality } from '@/api'

export interface Grade {
  quality: Quality
  label: string
  /** What the grade means, to cut down on SM-2's inherent ambiguity (ARCHITECTURE.md §3). */
  hint: string
}

/** The six SM-2 quality grades, labelled rather than just numbered (UI_DESIGN.md §4). Worst first. */
export const GRADES: readonly Grade[] = [
  { quality: 0, label: 'Blackout', hint: 'No memory of it at all' },
  { quality: 1, label: 'Wrong', hint: 'Got it wrong, but recognised it afterwards' },
  { quality: 2, label: 'Hard', hint: 'Wrong, though the answer felt easy once seen' },
  { quality: 3, label: 'Hesitant', hint: 'Correct, but only with real effort' },
  { quality: 4, label: 'Good', hint: 'Correct after a moment of thought' },
  { quality: 5, label: 'Perfect', hint: 'Instant, effortless recall' },
]
