import type { ReactNode } from 'react'
import { Repeat2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { useDocumentTitle } from '@/lib/useDocumentTitle'

interface AuthLayoutProps {
  title: string
  description: string
  /** e.g. "New here?" */
  footerText: string
  footerLinkText: string
  footerLinkTo: string
  children: ReactNode
}

/** Minimal centered-card layout for /login and /signup — no nav (UI_DESIGN.md §3). */
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
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-4">
      <p className="flex items-center gap-2 text-xl font-semibold">
        <span aria-hidden className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
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
    </main>
  )
}
