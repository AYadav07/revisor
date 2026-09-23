import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * TEMPORARY stand-in for a screen that hasn't been built yet, so the navigation, active-link
 * styling and route guards can be exercised end to end. Each use is deleted when its real page lands.
 */
export function PlaceholderPage({ title }: { title: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">{title}</CardTitle>
        <CardDescription>This screen is built in an upcoming block.</CardDescription>
      </CardHeader>
    </Card>
  )
}
