# Revisor — Architecture

Living document. Update whenever a decision changes — this is the source of truth over
chat history. See PRD.md for scope, API.md for endpoint contract, SECURITY.md for the
full security design, DEPLOYMENT.md for infra.

## 1. Style: modular monolith
**Decision: monolith, not microservices, not Kubernetes.** Microservices/K8s solve
organizational and orchestration-at-scale problems (independent team deployability,
rolling deploys across many instances) this project doesn't have — one person, one
coherent domain, a dataset that fits comfortably in a single Postgres instance on one VM.

**Structured as a modular monolith** — grouped by domain feature, so a future extraction
(if ever needed) is mechanical, not a rewrite:
```
com.revisor
├── course/      # entities, repo, service, controller, dto — course/topic/subtopic
├── review/      # SM-2 logic, review logs, schedule entries
├── auth/        # user, JWT (RS256), refresh tokens, admin role checks
├── admin/       # admin-only user management + cross-user read views + action log
├── dashboard/   # read-side queries across course + review, timezone-aware
└── shared/      # common exceptions, base classes
```
**Rule:** a module only calls another module's service interface, never its repository
directly.

## 2. Data model

| Entity | Key fields |
|---|---|
| `User` | id, name, email, password_hash, role (USER/ADMIN), enabled, timezone, created_at |
| `Course` | id, user_id, title, description |
| `Topic` | id, course_id, title, order_index, deleted_at (soft delete) |
| `Subtopic` | id, topic_id, title, notes, deleted_at (soft delete) |
| `LearningRecord` | id, subtopic_id, learned_at |
| `ReviewLog` | id, subtopic_id, reviewed_at, quality (0-5), ease_factor, interval_days, repetition_count |
| `ScheduleEntry` | id, subtopic_id, next_review_date |
| `RefreshToken` | id, user_id, family_id, token_hash, expires_at, revoked_at, created_at |
| `AdminAction` | id, admin_user_id, action, target_user_id, timestamp |

Indexes: `(user_id, id)` on ownership-checked tables; `(user_id, next_review_date)` for
dashboard "due" queries; `deleted_at` filtered in all topic and subtopic queries (soft
delete); `family_id` on `RefreshToken` for family-wide revocation lookups.

## 3. Spaced-repetition algorithm
**Decision: SM-2**, chosen over Leitner box and fixed intervals for long-term revision
efficiency at the cost of modest extra complexity. `SM2Calculator` is a pure
function/class, no Spring/JPA dependencies — unit-testable in isolation:
`(quality, previousEase, previousInterval, previousRepetitions) → new values`.

**Initial values (first `/learn`, no prior review):** `ease=2.5`, `repetitions=0`,
`interval=1 day` — `nextReviewDate = learnedAt + 1 day`. Standard SM-2 defaults.

**Low-quality reset:** on `/review`, `quality < 3` resets `repetition_count` to `0` and
`interval_days` to `1` (the review is still logged to `ReviewLog` as-is); `quality >= 3`
advances ease/interval/repetitions normally per the standard SM-2 formula.

**Idempotency:** calling `/learn` again on a subtopic that already has a `LearningRecord`
is a no-op — returns the existing record/schedule unchanged rather than erroring or
creating a duplicate (handles double-click/retry from the frontend).

## 4. Auth & multi-user model (see SECURITY.md for full detail)
- Self-service signup. Stateless-service architecture using RS256-signed JWTs (access +
  refresh, rotation on use). Tokens delivered as httpOnly cookies.
- Data isolation: every repository fetch/update/delete method is scoped by the
  authenticated user's ID *in the query itself* — never fetch-then-check. Foreign/missing
  resource → 404, never 403.
- Admin role: `role` column on `User`, granted only via manual migration (never
  self-service or in-app). Admin endpoints protected by `@PreAuthorize("hasRole('ADMIN')")`.

## 5. Scaling design principles
Decisions that must be right from the first migration/endpoint — expensive to retrofit
later. Everything else (caching, read replicas, async processing) bolts on without
touching these:
- Indexed ownership + dashboard queries — a single B-tree lookup regardless of userbase size.
- Pagination on every list endpoint, from day one.
- API versioning from the first endpoint (`/api/v1/...`).
- Stateless services (no in-memory session state).
- DTOs at the API boundary (MapStruct-mapped), entities never exposed directly.

## 6. Data lifecycle decisions
- **Subtopic delete: soft delete** (`deleted_at`), not hard delete — preserves
  months of SM-2 review history against accidental deletion. All read queries filter
  `deleted_at IS NULL`.
- **Topic delete: soft delete** (`deleted_at`), consistent with Subtopic — and
  **cascades**: deleting a topic soft-deletes all of its subtopics too (same
  `deleted_at IS NULL` filtering applies transitively). Review history under those
  subtopics is preserved, not destroyed.
- **Timezone**: `User.timezone` (IANA string, captured from the browser at signup via
  `Intl.DateTimeFormat().resolvedOptions().timeZone`, sent as part of the signup request —
  see API.md). Dashboard "due today/this week" is computed against the user's own
  timezone, not server/UTC time.
- **Review-without-learn: gated.** `/review` requires an existing `LearningRecord` for
  that subtopic (created by `/learn`); otherwise `409 Conflict`. No implicit auto-learn.
- **`/learn` idempotency:** repeat calls on an already-learned subtopic are a no-op (see §3).

## 7. Admin
- In-app admin view: list/search users, disable/enable, delete; **read-only** view of any
  user's courses/progress (deliberate, scoped exception to "no cross-user visibility").
- **Disable → revoke.** Disabling a user (`PATCH .../{id} { enabled: false }`) also
  revokes all of that user's outstanding refresh tokens — specifically, every token
  sharing their current token family (see SECURITY.md §Access + refresh tokens) — so
  they're logged out everywhere immediately rather than merely blocked on next refresh.
- **Delete requires disable first.** `DELETE /admin/users/{id}` returns `409 Conflict`
  unless the target user is already disabled — a deliberate two-step guard against
  accidental data loss. Once disabled, delete hard-cascades: the user row, all their
  courses/topics/subtopics (including soft-deleted ones), all review history
  (`LearningRecord`, `ReviewLog`, `ScheduleEntry`), and all `RefreshToken` rows for that
  user are permanently removed.
- No content editing on another user's data, no impersonation — out of scope unless a real
  need appears.
- All admin actions logged to `AdminAction` (who, what, on whom, when) — access to other
  users' private data should be auditable even at small scale.

## 8. Frontend
Structural/technical decisions below; visual design (theme, colors, component inventory,
page-by-page layout, forms) lives in **UI_DESIGN.md** — read both before building any UI.

- **Build tooling:** Vite (not Create React App — effectively unmaintained). Language:
  TypeScript, consistent with a backend built for type-safety end to end.
- **Styling:** Tailwind CSS + shadcn/ui (owned, copied-in components, not an installed
  library) — see UI_DESIGN.md §1 for rationale and the theming/centralization mechanism.
- **State management:** Context API + `useReducer` for genuinely global state (current
  user, auth status); local component state everywhere else. Same "don't build for a
  scale you don't have" principle as the backend — Redux solves team/complexity problems
  this app doesn't have. Revisit only if a specific pain point appears; a lightweight
  library like Zustand is the fallback, not Redux.
- **Data fetching:** TanStack Query (React Query) — handles loading/error state, caching,
  and refetch-after-mutation (e.g. dashboard refresh after `/review`) without hand-rolled
  `useEffect` boilerplate. This is a targeted addition, not scope creep — it removes a
  whole category of stale-data/race-condition bugs. The `/courses/:id` page fetches the
  whole course+topics+subtopics tree in a single `GET /courses/{id}` call (see API.md) —
  no per-topic or per-subtopic fetches needed to render the accordion.
- **Forms:** React Hook Form + Zod — see UI_DESIGN.md §6 for the shared pattern used
  across every form.
- **Routing:** React Router.
  ```
  /login, /signup
  /courses                    — course list
  /courses/:id                — topic tree for a course
  /subtopics/:id/review        — review-grading flow
  /dashboard                   — due today/this week, progress
  /admin/users                 — admin only, route-guarded by role
  ```
- **Component structure**, mirroring the backend's domain-first organization:
  ```
  src/
  ├── features/{auth,courses,review,dashboard,admin}/
  ├── components/ui/  # shadcn primitives — see UI_DESIGN.md §5
  ├── api/            # one file per backend module — courseApi.ts, reviewApi.ts, authApi.ts
  ├── components/     # truly shared, composed from components/ui — PageLayout, EmptyState
  └── App.tsx
  ```
- **Review-grading flow** (the one genuinely interactive piece): full UX detail in
  UI_DESIGN.md §4 — reveal-then-grade pattern with labeled quality buttons rather than
  bare 0-5 numbers, reducing the grading ambiguity flagged as an inherent SM-2 tradeoff
  in §3.
- **API calls:** `credentials: 'include'` on every request — required for the httpOnly
  auth cookies to be sent (see SECURITY.md, DEPLOYMENT.md §Frontend for the same-site
  domain implication of this).

## 9. Tech stack
- Backend: Spring Boot 3 (Java 21), Spring Data JPA, Spring Security, PostgreSQL, Flyway
- Auth: Nimbus JOSE+JWT (RS256), BCrypt (via Spring Security), Bucket4j (rate limiting)
- Mapping/validation: MapStruct, Bean Validation — plain Java, no Lombok
- API docs: springdoc-openapi (Swagger UI, gated/disabled in prod — see SECURITY.md)
- Observability: Logback (JSON in prod), Spring Boot Actuator (`/actuator/health`)
- Testing: JUnit 5, Mockito, Testcontainers (see below)
- Frontend: React + TypeScript, Vite, React Router, TanStack Query, Context API
- Infra: Docker + Docker Compose (no Kubernetes), Caddy reverse proxy (backend), GCP
  e2-micro Always Free tier (backend hosting — see DEPLOYMENT.md), Cloudflare Pages
  (frontend), GitHub Actions CI/CD
- Explicitly not used: Redis (no current job for it — see DEPLOYMENT.md), Kubernetes,
  Lombok, Redux

## 10. Testing strategy

| Layer | Test type | Example |
|---|---|---|
| Pure logic (SM2Calculator, mappers, validators) | Unit, no Spring context | quality=4, ease=2.5 → assert new ease/interval; quality=2 → assert repetitions reset to 0 |
| Services (ownership rules, review-gating) | Unit, mocked repositories | Review on never-learned subtopic → exception; repeat `/learn` call → no-op, not a new record |
| Repositories (ownership + dashboard queries) | Integration, Testcontainers (real Postgres) | Confirms actual SQL/index behavior |
| Controllers | Integration (MockMvc / full context) | Happy path + auth-required + 404-not-403 |
| Frontend components/hooks | React Testing Library | Review-grading flow submits correct quality value |

"Done" per milestone = pure logic has unit tests, each new endpoint has at least one
integration test (happy path + main failure mode).

## 11. Open questions
- Final domain name and registrar — pending an availability/pricing check (see
  DEPLOYMENT.md). Backend hosting platform is decided (GCP e2-micro free tier); this is
  the only remaining open decision in the doc set.