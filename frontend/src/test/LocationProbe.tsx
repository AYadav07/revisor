import { useLocation } from 'react-router-dom'

/** Shows the current URL, so a test can assert on navigation and query-string changes. */
export function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>
}
