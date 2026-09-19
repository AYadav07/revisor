# Prep Tracker — Architecture

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
com.preptracker
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
| `Topic` | id, course_id, title, order_index |
| `Subtopic` | id, topic_id, title, notes, deleted_at (soft delete) |
| `LearningRecord` | id, subtopic_id, learned_at |
| `ReviewLog` | id, subtopic_id, reviewed_at, quality (0-5), ease_factor, interval_days, repetition_count |
| `ScheduleEntry` | id, subtopic_id, next_review_date |
| `RefreshToken` | id, user_id, token_hash, expires_at, revoked_at, created_at |
| `AdminAction` | id, admin_user_id, action, target_user_id, timestamp |

Indexes: `(user_id, id)` on ownership-checked tables; `(user_id, next_review_date)` for
dashboard "due" queries; `deleted_at` filtered in all subtopic queries (soft delete).

## 3. Spaced-repetition algorithm
**Decision: SM-2**, chosen over Leitner box and fixed intervals for long-term revision
efficiency at the cost of modest extra complexity (see PRD history for full comparison).
`SM2Calculator` is a pure function/class, no Spring/JPA dependencies — unit-testable in
isolation: `(quality, previousEase, previousInterval, previousRepetitions) → new values`.

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
- **Timezone**: `User.timezone` (IANA string, captured from browser at signup). Dashboard
  "due today/this week" is computed against the user's own timezone, not server/UTC time.
- **Review-without-learn: gated.** `/review` requires an existing `LearningRecord` for
  that subtopic (created by `/learn`); otherwise `409 Conflict`. No implicit auto-learn.
- **Open / not yet decided:** whether admin-deleting a user hard-cascades their data or
  requires disabling first; whether disabling a user also revokes their refresh tokens.

## 7. Admin
- In-app admin view: list/search users, disable/enable, delete; **read-only** view of any
  user's courses/progress (deliberate, scoped exception to "no cross-user visibility").
- No content editing on another user's data, no impersonation — out of scope unless a real
  need appears.
- All admin actions logged to `AdminAction` (who, what, on whom, when) — access to other
  users' private data should be auditable even at small scale.

## 8. Frontend
React — chosen, but detailed design (state management, component structure, routing,
review-grading UX) is **deliberately deferred** until the backend is settled.

## 9. Tech stack
- Backend: Spring Boot 3 (Java 21), Spring Data JPA, Spring Security, PostgreSQL, Flyway
- Auth: Nimbus JOSE+JWT (RS256), BCrypt (via Spring Security), Bucket4j (rate limiting)
- Mapping/validation: MapStruct, Bean Validation — plain Java, no Lombok
- API docs: springdoc-openapi (Swagger UI, gated/disabled in prod — see SECURITY.md)
- Observability: Logback (JSON in prod), Spring Boot Actuator (`/actuator/health`)
- Testing: JUnit 5, Mockito, Testcontainers (see below)
- Frontend: React (detailed stack TBD)
- Infra: Docker + Docker Compose (no Kubernetes), Caddy reverse proxy, GitHub Actions CI/CD
- Explicitly not used: Redis (no current job for it — see DEPLOYMENT.md), Kubernetes

## 10. Testing strategy

| Layer | Test type | Example |
|---|---|---|
| Pure logic (SM2Calculator, mappers, validators) | Unit, no Spring context | quality=4, ease=2.5 → assert new ease/interval |
| Services (ownership rules, review-gating) | Unit, mocked repositories | Review on never-learned subtopic → exception |
| Repositories (ownership + dashboard queries) | Integration, Testcontainers (real Postgres) | Confirms actual SQL/index behavior |
| Controllers | Integration (MockMvc / full context) | Happy path + auth-required + 404-not-403 |

"Done" per milestone = pure logic has unit tests, each new endpoint has at least one
integration test (happy path + main failure mode).

## 11. Open questions
- Frontend state management, component structure, routing.
- Hard-delete cascade behavior for admin-deleted users.
- Whether disabling a user revokes their outstanding refresh tokens.
- Final project name (working title: Revisor).
