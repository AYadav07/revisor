import type { ReactNode } from 'react'

interface HeroHeaderProps {
  title: string
  description?: string | null
  /** Shown before the title, e.g. a course's badge. */
  leading?: ReactNode
  /** Page-level actions, at the right; style them for the colored background (see HERO_BUTTON). */
  actions?: ReactNode
}

/** Classes for a secondary button sitting on the hero's gradient: translucent white. */
export const HERO_BUTTON =
  'border-white/30 bg-white/10 text-white shadow-none hover:bg-white/20 hover:text-white dark:border-white/30 dark:bg-white/10'

/** Classes for the hero's primary action: solid white, brand-colored text. */
export const HERO_PRIMARY_BUTTON = 'bg-white text-primary shadow-md hover:bg-white/90 dark:text-hero-from'

/**
 * The colored banner that opens the dashboard and course pages (UI_DESIGN.md §4): the page's <h1>,
 * a line about it and its main actions, on the brand gradient. White text on the gradient's darker
 * `hero-*` stops stays readable in both themes.
 */
export function HeroHeader({ title, description, leading, actions }: HeroHeaderProps) {
  return (
    <section className="relative mb-8 overflow-hidden rounded-2xl bg-linear-to-br from-hero-from to-hero-to px-6 py-7 text-white shadow-lg shadow-hero-from/20 sm:px-8">
      {/* Two soft discs for depth; purely decorative. */}
      <span aria-hidden className="pointer-events-none absolute -top-20 -right-12 size-64 rounded-full bg-white/10" />
      <span aria-hidden className="pointer-events-none absolute -bottom-24 right-48 size-48 rounded-full bg-white/5" />
      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          {leading}
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
            {description && <p className="mt-1 max-w-prose text-sm text-white/85">{description}</p>}
          </div>
        </div>
        {actions}
      </div>
    </section>
  )
}
