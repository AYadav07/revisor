# CLAUDE.md — Project context for Claude Code

Read automatically at the start of every session in this repo. This is a quick-reference
summary — read the full docs before implementing anything non-trivial:
`PRD.md` (scope/goals), `ARCHITECTURE.md` (system design), `API.md` (endpoint contract),
`SECURITY.md` (auth/token/hardening detail), `DEPLOYMENT.md` (infra).

## What this project is
Prep Tracker (working title "Revisor"): a personal interview-prep app. Organize prep
material as Courses → Topics → Subtopics, mark them learned, then revise on an SM-2
spaced-repetition schedule. Self-signup, multi-user (owner + friends), with a minimal
admin view.

## Architecture — modular monolith (ARCHITECTURE.md §1)
```
com.preptracker
├── course/      # course/topic/subtopic entities, repo, service, controller, dto
├── review/      # SM-2 logic, review logs, schedule entries
├── auth/        # user, JWT (RS256), refresh tokens
├── admin/       # admin-only user management + cross-user read views + action log
├── dashboard/   # read-side queries across course + review, timezone-aware
└── shared/      # common exceptions, base classes
```
**Rule: a module only calls another module's service interface, never its repository
directly.**

## Non-negotiable patterns
- **Ownership scoping at the query level, always.** Every fetch/update/delete repository
  method is scoped by the authenticated user's ID in the query itself
  (`findByIdAndUserId`) — never fetch-then-check. Missing/foreign resource → 404, never 403.
- **`SM2Calculator` stays a pure function/class** — no Spring or JPA dependencies.
  Unit-testable in isolation.
- **DTOs at the API boundary** (MapStruct-mapped) — never expose JPA entities directly.
- **Errors: RFC 7807 Problem Details** — see API.md for the shape.
- **Admin role is never self-granted** — only via manual Flyway migration. Admin
  endpoints use `@PreAuthorize("hasRole('ADMIN')")`, and every admin action writes to the
  `AdminAction` log.
- **Subtopic delete is soft delete** (`deleted_at`) — all read queries filter it out.
- **`/review` requires an existing `LearningRecord`** (created by `/learn`) — otherwise
  409, no implicit auto-learn.
- Tokens are RS256 JWTs (access, 15 min) + opaque rotating refresh tokens (14 days,
  hashed in DB), delivered as httpOnly cookies — never localStorage, never HS256.

## Explicitly not used (don't introduce without flagging it)
Kubernetes, Redis, Lombok. Reasons are in ARCHITECTURE.md/DEPLOYMENT.md — don't add these
back in "for best practice" without raising it first.

## Working conventions
- Implement one milestone/slice at a time (PRD.md §6). Don't build multiple modules in
  one pass.
- Don't introduce new architectural decisions (dependencies, patterns, deviating from the
  module structure) without flagging it — this project deliberately finalizes design in
  chat before writing code.
- Testing: pure logic (SM2Calculator, mappers, validators) gets unit tests with no Spring
  context; repositories get Testcontainers integration tests; controllers get MockMvc/full
  context integration tests covering happy path + main failure mode. See ARCHITECTURE.md
  §10 for the full table.
- Frontend design (state management, component structure, routing) is **not yet decided**
  — don't assume a pattern for it.
- Open items live in each doc's "Open items"/"Open questions" section — check before
  assuming something is settled.
- When this file conflicts with the other docs, they win — update this summary to match.
