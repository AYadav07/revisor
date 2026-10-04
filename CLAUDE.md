# CLAUDE.md — Project context for Claude Code

Read automatically at the start of every session in this repo. This is a quick-reference
summary — read the full docs before implementing anything non-trivial:
`PRD.md` (scope/goals), `ARCHITECTURE.md` (system design incl. frontend structure and the
notification module), `UI_DESIGN.md` (visual design — theme, colors, components, pages,
forms), `API.md` (endpoint contract), `SECURITY.md` (auth/token/email-verification/
hardening detail), `DEPLOYMENT.md` (infra for frontend, backend and email delivery).

## What this project is
Revisor: a personal interview-prep app. Organize prep
material as Courses → Topics → Subtopics, mark them learned, then revise on an SM-2
spaced-repetition schedule. Self-signup with email verification and password reset,
multi-user (owner + friends), with a minimal admin view. React frontend, Spring Boot
backend, deployed as two separate services on subdomains of `aydev.in`:
`revisor.aydev.in` (frontend) and `api.revisor.aydev.in` (backend).

## Architecture — modular monolith (ARCHITECTURE.md §1)
```
com.ay.revisor
├── course/        # course/topic/subtopic entities, repo, service, controller, dto
├── review/        # SM-2 logic, review logs, schedule entries
├── auth/          # user, JWT (RS256), refresh tokens, email verification, password reset
├── notification/  # channel-agnostic notifications: routing, rendering, transport (email now)
├── admin/         # admin-only user management + cross-user read views + action log
├── dashboard/     # read-side queries across course + review, timezone-aware
└── shared/        # common exceptions, base classes, cross-module domain event types
```
**Rule: a module only calls another module's service interface, never its repository
directly.** One sanctioned exception: `auth` → `notification` communicates via Spring
domain events (ARCHITECTURE.md §8), so `auth` never depends on `notification` at all.

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
- **Email verification / password reset tokens** are opaque, single-use, expiring, and
  stored only as a SHA-256 hash (SECURITY.md §Email verification & password reset).
  Unverified users cannot log in (403 `email-not-verified`). `forgot-password` and
  `resend-verification` always return 202, whether or not the email exists.
- **Notifications:** `auth` publishes a domain event; `notification` sends after commit,
  async. Never call SMTP (or any provider) from `auth`. Email goes out through the
  `EmailSender` interface over plain SMTP, with templates in the repo — switching provider
  is a config change, never a code change.
- **Frontend and backend live on subdomains of one registrable domain**
  (`revisor.aydev.in` / `api.revisor.aydev.in`), required for `SameSite=Strict` cookies to
  work — don't assume default platform domains.
- Frontend: Context API + local state for state management (no Redux), TanStack Query for
  data fetching (no hand-rolled fetch/useEffect for server state), React Router, Tailwind
  CSS + shadcn/ui for styling, React Hook Form + Zod for every form.
- **Frontend components are always built from `components/ui/` primitives** (shadcn) —
  never style a raw HTML element directly. Theme colors/spacing come from the CSS
  variables in UI_DESIGN.md §2 — never hardcode a hex color or pixel value in a component.

## Explicitly not used (don't introduce without flagging it)
Kubernetes, Redis, Lombok, Redux, Material UI/other component libraries, CSS-in-JS,
email-provider SDKs or provider-hosted email templates (SMTP only — see DEPLOYMENT.md),
SMS (the notification module leaves room for it, but it is not built in v1).
Reasons are in ARCHITECTURE.md/UI_DESIGN.md/DEPLOYMENT.md — don't add these back in "for
best practice" without raising it first.

## Working conventions
- Implement one milestone/slice at a time (PRD.md §6). Don't build multiple modules in
  one pass.
- Don't introduce new architectural decisions (dependencies, patterns, deviating from the
  module structure) without flagging it — this project deliberately finalizes design in
  chat before writing code.
- Testing: pure logic (SM2Calculator, mappers, validators, token hashing, channel routing)
  gets unit tests with no Spring context; repositories get Testcontainers integration
  tests; controllers get MockMvc/full context integration tests covering happy path + main
  failure mode; email sending is integration-tested against an in-process GreenMail SMTP
  server, never a real provider; frontend components/hooks get React Testing Library
  tests. See ARCHITECTURE.md §11 for the full table. `./gradlew test` always runs on the in-memory `local` profile (set in build.gradle) — never
  on `dev`, whose Postgres is the developer's real data and which controller tests wipe.
  Testcontainers-backed tests are tagged `postgres` and excluded from the default
  `./gradlew test` run (they need a reachable Docker daemon) — run them explicitly with
  `./gradlew test -PincludePostgresTests`.
- Open items live in each doc's "Open items"/"Open questions" section — check before
  assuming something is settled. As of this writing the doc set has no open decisions —
  the domain (`aydev.in`: GoDaddy registrar, DNS on Cloudflare), the email provider (Resend),
  backend hosting platform and the admin-delete cascade
  edge cases have all been decided.
- When this file conflicts with the other docs, they win — update this summary to match.