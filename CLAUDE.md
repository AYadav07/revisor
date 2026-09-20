# CLAUDE.md — Project context for Claude Code

Read automatically at the start of every session in this repo. This is a quick-reference
summary — read the full docs before implementing anything non-trivial:
`PRD.md` (scope/goals), `ARCHITECTURE.md` (system design incl. frontend structure),
`UI_DESIGN.md` (visual design — theme, colors, components, pages, forms), `API.md`
(endpoint contract), `SECURITY.md` (auth/token/hardening detail), `DEPLOYMENT.md` (infra
for both frontend and backend).

## What this project is
Revisor: a personal interview-prep app. Organize prep
material as Courses → Topics → Subtopics, mark them learned, then revise on an SM-2
spaced-repetition schedule. Self-signup, multi-user (owner + friends), with a minimal
admin view. React frontend, Spring Boot backend, deployed as two separate services on
one custom domain (subdomains).

## Architecture — modular monolith (ARCHITECTURE.md §1)
```
com.revisor
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
- **Frontend and backend live on subdomains of one custom domain** (`app.` / `api.`),
  required for `SameSite=Strict` cookies to work — don't assume default platform domains.
- Frontend: Context API + local state for state management (no Redux), TanStack Query for
  data fetching (no hand-rolled fetch/useEffect for server state), React Router, Tailwind
  CSS + shadcn/ui for styling, React Hook Form + Zod for every form.
- **Frontend components are always built from `components/ui/` primitives** (shadcn) —
  never style a raw HTML element directly. Theme colors/spacing come from the CSS
  variables in UI_DESIGN.md §2 — never hardcode a hex color or pixel value in a component.

## Explicitly not used (don't introduce without flagging it)
Kubernetes, Redis, Lombok, Redux, Material UI/other component libraries, CSS-in-JS.
Reasons are in ARCHITECTURE.md/UI_DESIGN.md/DEPLOYMENT.md — don't add these back in "for
best practice" without raising it first.

## Working conventions
- Implement one milestone/slice at a time (PRD.md §6). Don't build multiple modules in
  one pass.
- Don't introduce new architectural decisions (dependencies, patterns, deviating from the
  module structure) without flagging it — this project deliberately finalizes design in
  chat before writing code.
- Testing: pure logic (SM2Calculator, mappers, validators) gets unit tests with no Spring
  context; repositories get Testcontainers integration tests; controllers get MockMvc/full
  context integration tests covering happy path + main failure mode; frontend
  components/hooks get React Testing Library tests. See ARCHITECTURE.md §10 for the full
  table.
- Open items live in each doc's "Open items"/"Open questions" section — check before
  assuming something is settled (e.g. backend hosting platform, final domain name, and two
  admin-delete cascade edge cases are still open).
- When this file conflicts with the other docs, they win — update this summary to match.