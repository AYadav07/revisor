import type { ReactNode } from 'react'
import { CalendarClock, ListTree, Repeat2, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { useDocumentTitle } from '@/lib/useDocumentTitle'

const FEATURES = [
  { icon: ListTree, text: 'Organize prep into courses, topics and subtopics' },
  { icon: CalendarClock, text: 'Reviews scheduled for you with spaced repetition' },
  { icon: TrendingUp, text: "See what's due today and what's coming up" },
]

interface AuthLayoutProps {
  title: string
  description: string
  /** e.g. "New here?" */
  footerText: string
  footerLinkText: string
  footerLinkTo: string
  children: ReactNode
}

/** Minimal centered-card layout for the public auth pages (sign in, sign up, email links) — no nav (UI_DESIGN.md §3). */
export function AuthLayout({
  title,
  description,
  footerText,
  footerLinkText,
  footerLinkTo,
  children,
}: AuthLayoutProps) {
  useDocumentTitle(title)
  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-2">
      {/* Brand panel, wide screens only: what the app is, in three plain lines. */}
      <section className="relative hidden overflow-hidden bg-linear-to-br from-hero-from to-hero-to p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <span aria-hidden className="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-white/10" />
        <span aria-hidden className="pointer-events-none absolute -bottom-32 -left-16 size-80 rounded-full bg-white/5" />
        <p className="relative flex items-center gap-2.5 text-xl font-semibold">
          <span aria-hidden className="flex size-9 items-center justify-center rounded-lg bg-white/15">
            <Repeat2 className="size-5" />
          </span>
          Revisor
        </p>
        <div className="relative max-w-md">
          <p className="text-3xl leading-tight font-semibold tracking-tight">
            Revise what you learn, right before you forget it.
          </p>
          <ul className="mt-8 space-y-4 text-white/90">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/15">
                  <Icon className="size-5" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-white/70">Spaced repetition for interview prep.</p>
      </section>

      <div className="flex flex-col items-center justify-center gap-6 p-4">
        <p className="flex items-center gap-2 text-xl font-semibold lg:hidden">
          <span aria-hidden className="flex size-9 items-center justify-center rounded-lg bg-linear-to-br from-primary to-brand-2 text-white">
            <Repeat2 className="size-5" />
          </span>
          Revisor
        </p>
        <Card className="w-full max-w-sm shadow-md">
          <CardHeader>
            <CardTitle className="text-2xl">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent>{children}</CardContent>
          <CardFooter className="justify-center gap-1 text-sm text-muted-foreground">
            {footerText}
            <Button asChild variant="link" className="h-auto p-0">
              <Link to={footerLinkTo}>{footerLinkText}</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </main>
  )
}
