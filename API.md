# Revisor — API Contract

Living document. See ARCHITECTURE.md for design rationale, SECURITY.md for auth/cookie
details, DEPLOYMENT.md for the cross-origin/custom-domain implications of cookie auth.

## Conventions
- All endpoints under `/api/v1`.
- Auth: RS256 JWT access token delivered as an httpOnly cookie, sent automatically by the
  browser. Refresh token also an httpOnly cookie, scoped to `/api/v1/auth` (see SECURITY.md for why
  not `/auth/refresh`).
  `Secure` is set in production; dropped in the `local`/`dev` Spring profile since local
  dev runs over plain HTTP (see SECURITY.md).
- List endpoints paginated: `{ "content": [...], "page": 0, "size": 20, "totalElements": 0 }`.
  Query params `page` (default `0`) and `size` (default `20`, max `100`) — an out-of-range or
  non-numeric value is a `400` validation error, not a silent clamp.
- Errors: RFC 7807 Problem Details —
  ```json
  {
    "type": "https://revisor.dev/errors/validation-failed",
    "title": "Validation failed",
    "status": 400,
    "detail": "One or more fields are invalid",
    "instance": "/api/v1/courses",
    "errors": [{ "field": "title", "message": "must not be blank" }]
  }
  ```
- Ownership enforced server-side from the JWT at the query level; a resource owned by
  another user returns `404`, never `403`.
- DTOs: separate request/response shapes, entities never exposed directly, mapped via
  MapStruct.
- Interactive docs generated from code via springdoc-openapi (`/swagger-ui.html`, spec at
  `/v3/api-docs`) — served in local/dev, disabled in production.
- Every response carries an `X-Request-Id` header (a well-formed one sent by the caller is echoed;
  otherwise the server generates one) for correlating with server logs.
- Rate limits return `429` Problem Details with a `Retry-After` header (seconds): `/auth/login` 5
  attempts per email per 15 minutes, `/auth/signup` 10 per IP per hour (see SECURITY.md).
- `GET /actuator/health` is public and returns only `{ "status": "UP" }`-style output.

## Auth
```
POST   /api/v1/auth/signup   { name, email, password, timezone } -> 201, returns { id, name, email, role }
POST   /api/v1/auth/login    { email, password } -> sets access + refresh cookies, returns { user: { id, name, email, role } }
POST   /api/v1/auth/refresh  -> rotates refresh token, sets new access + refresh cookies, returns { user: { id, name, email, role } }
POST   /api/v1/auth/logout   -> revokes refresh token server-side, clears cookies
```
`timezone` is an IANA string captured client-side via
`Intl.DateTimeFormat().resolvedOptions().timeZone` at signup — see ARCHITECTURE.md §6.

Password reset / "forgot password" is out of scope for v1 (see PRD.md §4) — no endpoint
exists for it yet.

## Courses / Topics / Subtopics
```
POST   /api/v1/courses                    { title, description }
GET    /api/v1/courses                    -> paginated
GET    /api/v1/courses/{id}               -> course with topics + subtopics nested (see below)
PUT    /api/v1/courses/{id}                { title, description }
DELETE /api/v1/courses/{id}

POST   /api/v1/courses/{id}/topics         { title, orderIndex }
GET    /api/v1/topics/{id}
PUT    /api/v1/topics/{id}                 { title, orderIndex }
DELETE /api/v1/topics/{id}                 -> soft delete (sets deleted_at), cascades to
                                               soft-deleting all of the topic's subtopics

POST   /api/v1/topics/{id}/subtopics       { title, notes }
GET    /api/v1/subtopics/{id}
PUT    /api/v1/subtopics/{id}              { title, notes }
DELETE /api/v1/subtopics/{id}              -> soft delete (sets deleted_at)
```

**`GET /api/v1/courses/{id}` response shape** — the whole tree in one call, to back the
`/courses/:id` page (`TopicAccordion` → `SubtopicRow` in UI_DESIGN.md) without extra
round-trips:
```json
{
  "id": 1,
  "title": "System Design",
  "description": "...",
  "topics": [
    {
      "id": 10,
      "title": "Load Balancing",
      "orderIndex": 0,
      "subtopics": [
        { "id": 100, "title": "L4 vs L7", "notes": "...", "learned": true, "nextReviewDate": "2026-09-25" }
      ]
    }
  ]
}
```
Soft-deleted topics/subtopics (`deleted_at IS NOT NULL`) are excluded from this response.
No separate `GET /courses/{id}/topics` or `GET /topics/{id}/subtopics` list endpoints —
the nested response is the only way the tree is fetched.

Topic reordering (persisting drag-and-drop changes to `order_index`) is not yet in
scope — deferred until the frontend actually needs it; `PUT /topics/{id}` can carry an
updated `orderIndex` in the meantime if a one-off reorder is needed.

## Learning & review
```
POST   /api/v1/subtopics/{id}/learn
       -> creates LearningRecord + initial ScheduleEntry, seeded with SM-2 defaults
          (ease=2.5, repetitions=0, interval=1 day) — see ARCHITECTURE.md §3
       -> idempotent: calling this again on an already-learned subtopic is a no-op,
          returns 200 with the existing LearningRecord/schedule unchanged (no duplicate
          record, no error)
       response: { subtopicId, learnedAt, nextReviewDate }

POST   /api/v1/subtopics/{id}/review       { quality: 0-5 }
       -> 409 Conflict if subtopic has no LearningRecord yet
       -> runs SM2Calculator, writes ReviewLog, updates ScheduleEntry
       -> quality < 3 resets repetitionCount to 0 and intervalDays to 1 (see
          ARCHITECTURE.md §3); quality >= 3 advances normally
       response: { subtopicId, easeFactor, intervalDays, nextReviewDate, repetitionCount }
```

## Dashboard
```
GET    /api/v1/dashboard/due?range=today|week   -> paginated, computed in the user's own timezone
GET    /api/v1/dashboard/progress               -> per-course completion stats (a plain array, not paginated)
GET    /api/v1/dashboard/summary                -> { dueToday, overdue, totalLearned } — the stat tiles
```
- `range=week` is a rolling seven days (today plus the next six), not Monday–Sunday. Both ranges
  include anything overdue. `range` is case-insensitive and defaults to `today`.
- `/summary`: `dueToday` is subtopics scheduled exactly today, `overdue` strictly before today
  (so `dueToday + overdue` equals `/due?range=today`'s `totalElements`), and `totalLearned` counts
  learned subtopics that still exist. "Today" is the caller's own timezone throughout.
- Soft-deleted subtopics never appear in any dashboard number.

## Admin (requires ADMIN role — 403 if authenticated as USER)
```
GET    /api/v1/admin/users?q=                    -> paginated; q matches name or email,
                                                     case-insensitively; omit q to list everyone
PATCH  /api/v1/admin/users/{id}    { enabled: false }
                                    -> also revokes all of the user's outstanding refresh
                                       tokens (whole token family — see SECURITY.md),
                                       forcing logout everywhere immediately
DELETE /api/v1/admin/users/{id}                  -> 409 Conflict unless the user is
                                                     already disabled (enabled: false);
                                                     once disabled, hard-cascades: deletes
                                                     the user and all of their courses,
                                                     topics, subtopics, review history and
                                                     refresh tokens
GET    /api/v1/admin/users/{id}/courses          -> paginated read-only view of that user's
                                                     courses, each with { learnedCount, totalCount }
```
An admin cannot `PATCH`/`DELETE` their own account — `409 Conflict`, same as the
already-disabled case above, so no separate error shape to handle. Every admin action
(including a plain `GET /admin/users` list/search) is written to the `AdminAction` log
(see ARCHITECTURE.md §2).

## Open items
- None currently — see PRD.md §7 for v2+ scope (password reset, topic reordering, etc.)
  intentionally deferred rather than undecided.