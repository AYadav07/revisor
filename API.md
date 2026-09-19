# Prep Tracker — API Contract

Living document. See ARCHITECTURE.md for design rationale, SECURITY.md for auth/cookie
details.

## Conventions
- All endpoints under `/api/v1`.
- Auth: RS256 JWT access token delivered as an httpOnly cookie, sent automatically by the
  browser. Refresh token also an httpOnly cookie, scoped to `/api/v1/auth/refresh`.
- List endpoints paginated: `{ "content": [...], "page": 0, "size": 20, "totalElements": 0 }`
- Errors: RFC 7807 Problem Details —
  ```json
  {
    "type": "https://preptracker.dev/errors/validation-failed",
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
- Interactive docs generated from code via springdoc-openapi (`/swagger-ui.html`) —
  disabled or auth-gated in production.

## Auth
```
POST   /api/v1/auth/signup   { name, email, password } -> 201
POST   /api/v1/auth/login    { email, password } -> sets access + refresh cookies, returns { user: { id, name, email, role } }
POST   /api/v1/auth/refresh  -> rotates refresh token, sets new access + refresh cookies
POST   /api/v1/auth/logout   -> revokes refresh token server-side, clears cookies
```

## Courses / Topics / Subtopics
```
POST   /api/v1/courses                    { title, description }
GET    /api/v1/courses                    -> paginated
GET    /api/v1/courses/{id}
PUT    /api/v1/courses/{id}                { title, description }
DELETE /api/v1/courses/{id}
POST   /api/v1/courses/{id}/topics         { title, orderIndex }
GET    /api/v1/topics/{id}
POST   /api/v1/topics/{id}/subtopics       { title, notes }
GET    /api/v1/subtopics/{id}
PUT    /api/v1/subtopics/{id}              { title, notes }
DELETE /api/v1/subtopics/{id}              -> soft delete (sets deleted_at)
```

## Learning & review
```
POST   /api/v1/subtopics/{id}/learn
       -> creates LearningRecord + initial ScheduleEntry
       response: { subtopicId, learnedAt, nextReviewDate }

POST   /api/v1/subtopics/{id}/review       { quality: 0-5 }
       -> 409 Conflict if subtopic has no LearningRecord yet
       -> runs SM2Calculator, writes ReviewLog, updates ScheduleEntry
       response: { subtopicId, easeFactor, intervalDays, nextReviewDate, repetitionCount }
```

## Dashboard
```
GET    /api/v1/dashboard/due?range=today|week   -> paginated, computed in the user's own timezone
GET    /api/v1/dashboard/progress               -> per-course completion stats
```

## Admin (requires ADMIN role — 403 if authenticated as USER)
```
GET    /api/v1/admin/users                       -> paginated, list/search all users
PATCH  /api/v1/admin/users/{id}    { enabled: false }
DELETE /api/v1/admin/users/{id}                  -> cascade behavior: open question, see ARCHITECTURE.md §11
GET    /api/v1/admin/users/{id}/courses          -> read-only view of that user's courses/progress
```
Every admin action is written to the `AdminAction` log (see ARCHITECTURE.md §2).

## Open items
- Hard-delete cascade behavior for `DELETE /admin/users/{id}`.
- Whether `PATCH .../{id} { enabled: false }` also revokes the user's outstanding refresh tokens.
