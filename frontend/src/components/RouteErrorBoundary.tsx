import { Component, type ReactNode } from 'react'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'

interface RouteErrorBoundaryProps {
  /** When this changes (the user navigated), a previous failure is forgotten and the new page gets a go. */
  resetKey: string
  children: ReactNode
}

interface RouteErrorBoundaryState {
  failed: boolean
  /** The resetKey the current state belongs to. */
  key: string
}

/**
 * Keeps a page that fails to load or render from blanking the whole app. The usual cause is a
 * route's lazily loaded code failing to download (offline, or a stale tab after a new deploy), for
 * which a reload is the fix; any render error in a page lands here too.
 */
export class RouteErrorBoundary extends Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
  state: RouteErrorBoundaryState = { failed: false, key: this.props.resetKey }

  static getDerivedStateFromError(): Partial<RouteErrorBoundaryState> {
    return { failed: true }
  }

  // Resetting here, during render, rather than in componentDidUpdate means the new page renders
  // straight away instead of the message flashing for one extra pass.
  static getDerivedStateFromProps(props: RouteErrorBoundaryProps, state: RouteErrorBoundaryState) {
    return props.resetKey === state.key ? null : { failed: false, key: props.resetKey }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <EmptyState
        title="Something went wrong"
        description="This page couldn't be shown. Reloading usually fixes it."
        action={<Button onClick={() => window.location.reload()}>Reload page</Button>}
      />
    )
  }
}
