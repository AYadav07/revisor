import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/features/auth/useAuth'

// TEMPORARY placeholder: just enough of an authenticated page to prove sign-in works end to end.
// The real dashboard (stat tiles, due list, progress) and the AppShell — with the user menu that
// takes over this sign-out button — arrive in later blocks.
export function DashboardPage() {
  const { user, logout } = useAuth()

  async function handleSignOut() {
    try {
      await logout()
    } catch {
      toast.error("Couldn't reach the server, so you may still be signed in.")
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Dashboard</CardTitle>
          <CardDescription>Signed in as {user?.name}. The real dashboard lands in a later block.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={handleSignOut}>
            Sign out
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
