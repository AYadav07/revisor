import { cn } from 'cn'

const SIZES = {
  sm: 'size-6 rounded-md text-xs',
  md: 'size-10 rounded-lg text-sm',
  lg: 'size-12 rounded-xl text-base',
} as const

/** Up to two initials: the first letter of the first two words, skipping symbols like "&". */
function courseInitials(title: string): string {
  const words = title.split(/\s+/).filter((word) => /^[\p{L}\p{N}]/u.test(word))
  return words
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('')
}

/**
 * A course's badge: its initials on the brand tint. One tint for every course, on purpose — a
 * distinct color per course would stop being tellable apart past a handful of courses (checked with
 * the data-viz palette validator), and would clash with the state colors. The initials and the name
 * beside it identify the course.
 */
export function CourseAvatar({ title, size = 'md', className }: { title: string; size?: keyof typeof SIZES; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('flex shrink-0 items-center justify-center bg-primary/10 font-semibold text-primary', SIZES[size], className)}
    >
      {courseInitials(title)}
    </span>
  )
}
