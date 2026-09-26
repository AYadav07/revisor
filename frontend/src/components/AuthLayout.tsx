import type { ReactNode } from 'react'
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
    <main className="flex min-h-screen items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-sm">
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
