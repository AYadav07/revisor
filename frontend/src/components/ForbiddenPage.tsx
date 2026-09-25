import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ROUTES } from '@/routes'

/** Shown to a signed-in user who opens a page their role doesn't allow. */
export function ForbiddenPage() {
  return (
    <Card role="alert">
      <CardHeader>
        <CardTitle className="text-2xl">Not authorized</CardTitle>
        <CardDescription>You don't have access to this page.</CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild variant="outline">
          <Link to={ROUTES.dashboard}>Back to the dashboard</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
