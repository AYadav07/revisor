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
com.ay.revisor
├── course/        # entities, repo, service, controller, dto — course/topic/subtopic
├── review/        # SM-2 logic, review logs, schedule entries
├── auth/          # user, JWT (RS256), refresh tokens, admin role checks,
│                  #   email verification + password reset tokens
├── notification/  # channel-agnostic notifications — routing, rendering, transport (§8)
├── admin/         # admin-only user management + cross-user read views + action log
├── dashboard/     # read-side queries across course + review, timezone-aware
└── shared/        # common exceptions, base classes, cross-module domain event types
```
**Rule:** a module only calls another module's service interface, never its repository
directly.

**Sanctioned exception — domain events for notifications.** `auth` does not call
`notification` at all; it publishes a domain event (e.g. `PasswordResetRequested`) and
`notification` listens. This gives send-after-commit and non-blocking behavior for free,
and keeps `auth` with zero compile-time dependency on `notification` (see §8). Event
record types live in `shared/` so neither module depends on the other.

## 2. Data model

| Entity | Key fields |
|---|---|
| `User` | id, name, email, password_hash, role (USER/ADMIN), enabled, email_verified_at (nullable), timezone, created_at |
| `Course` | id, user_id, title, description |
| `Topic` | id, course_id, title, order_index, deleted_at (soft delete) |
| `Subtopic` | id, topic_id, title, notes, deleted_at (soft delete) |
| `LearningRecord` | id, subtopic_id, learned_at |
| `ReviewLog` | id, subtopic_id, reviewed_at, quality (0-5), ease_factor, interval_days, repetition_count |
| `ScheduleEntry` | id, subtopic_id, next_review_date |
| `RefreshToken` | id, user_id, family_id, token_hash, expires_at, revoked_at, created_at |
| `EmailToken` | id, user_id, purpose (VERIFY_EMAIL/RESET_PASSWORD), token_hash, expires_at, used_at, created_at |
| `AdminAction` | id, admin_user_id, action, target_user_id, timestamp |

Indexes: `(user_id, id)` on ownership-checked tables; `(user_id, next_review_date)` for
dashboard "due" queries; `deleted_at` filtered in all topic and subtopic queries (soft
delete); `family_id` on `RefreshToken` for family-wide revocation lookups; unique
`token_hash` on `EmailToken` (lookup on redemption) plus `(user_id, purpose)` for
invalidating a user's older tokens.

`email_verified_at` is a timestamp rather than a boolean — "verified" is
`email_verified_at IS NOT NULL`, and the timestamp is free audit data. It and the
`EmailToken` table arrive in migration `V3` (both `h2/` and `postgresql/`), which backfills
`email_verified_at = created_at` for existing users so nobody is locked out (SECURITY.md).

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
- Self-service signup with **mandatory email verification** before first login; password
  reset via emailed link. Both use single-use, hashed, expiring `EmailToken`s.
- Stateless-service architecture using RS256-signed JWTs (access + refresh, rotation on
  use). Tokens delivered as httpOnly cookies.
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
- Side effects to external systems (email) happen off the request thread, after commit.

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
- **Email tokens:** expired or used `EmailToken` rows are purged by a daily `@Scheduled`
  job; they have no audit value once dead.

## 7. Admin
- In-app admin view: list/search users (incl. verified status), disable/enable, delete; **read-only** view of any
  user's courses/progress (deliberate, scoped exception to "no cross-user visibility").
- **Disable → revoke.** Disabling a user (`PATCH .../{id} { enabled: false }`) also
  revokes *every* outstanding refresh token belonging to that user — every family, not
  just their most recent login — so they're logged out everywhere (every device, every
  session) immediately rather than merely blocked on next refresh. A narrower
  "just their current family" revoke was considered and rejected: it would leave other
  concurrent sessions (a second device, a second browser) still logged in after a disable,
  defeating the point.
- **An admin cannot disable or delete their own account** — `409 Conflict`, same status as
  the "target still enabled" case below, so there's no separate error shape for a client
  to handle. Other admins are not protected from each other.
- **Delete requires disable first.** `DELETE /admin/users/{id}` returns `409 Conflict`
  unless the target user is already disabled — a deliberate two-step guard against
  accidental data loss. Once disabled, delete hard-cascades: the user row, all their
  courses/topics/subtopics (including soft-deleted ones), all review history
  (`LearningRecord`, `ReviewLog`, `ScheduleEntry`), and all `RefreshToken` and
  `EmailToken` rows for that user are permanently removed.
- No content editing on another user's data, no impersonation — out of scope unless a real
  need appears.
- All admin actions logged to `AdminAction` (who, what, on whom, when) — access to other
  users' private data should be auditable even at small scale. `admin_user_id` and
  `target_user_id` are plain historical IDs with **no foreign key** to `app_user` (dropped
  in V2): a `DELETE_USER` row must keep the deleted user's ID, which an FK with
  `ON DELETE SET NULL` would erase.

## 8. Notifications
**Goal:** send transactional messages (v1: verification + password-reset emails) such
that (a) the email provider can be swapped with a config change, and (b) a new channel
like SMS can be added later with new classes only — no rewrite of existing ones.

**Three separated responsibilities:**
1. **What** to notify — domain intent ("a password reset was requested"). Owned by `auth`,
   expressed as a domain event. `auth` knows nothing about emails, templates or SMTP.
2. **How it reads** — subject/HTML/text for email, short text for SMS. Owned by a
   `TemplateRenderer` (Thymeleaf), templates in the repo per `(type, channel)`.
3. **How it's delivered** — SMTP today, an SMS gateway later. Owned by small
   per-medium transport interfaces.

**Flow:**
```
auth: publishes PasswordResetRequested(userId, rawToken)   (inside its transaction)
        │  @TransactionalEventListener(AFTER_COMMIT) + @Async
notification: NotificationListener → builds Notification
        → NotificationService.notify(notification)
        → ChannelRouter: channels configured for this NotificationType
        → for each: NotificationChannel.send(notification)
             EmailChannel → TemplateRenderer + EmailSender  → SmtpEmailSender
             SmsChannel   → TemplateRenderer + SmsSender    → (v2+, not built)
```
AFTER_COMMIT means no email is ever sent for a signup/reset that rolled back; `@Async`
means a slow or failing SMTP call never delays or fails the HTTP request. The raw token
travels only in-memory in the event — it is never persisted except as its hash. Links are
built from `app.frontend-url` (`https://revisor.aydev.in` in production).

**Core types:**
```java
enum NotificationType { VERIFY_EMAIL, PASSWORD_RESET }
enum Channel { EMAIL, SMS }

record Recipient(String name, String email, String phone) {}   // phone unused in v1
record Notification(NotificationType type, Recipient to, Map<String, Object> data) {}

interface NotificationChannel {          // one implementation per channel
    Channel channel();
    void send(Notification notification); // render + deliver; skips if no address
}

interface EmailSender { void send(EmailMessage m); } // to, subject, html, text
interface SmsSender   { void send(SmsMessage m); }   // to, text — v2+
```
`NotificationService` receives every channel as `List<NotificationChannel>` (Spring
injects all beans), indexed by `channel()`. Routing is config, not code:
```yaml
app.notifications.routes:
  VERIFY_EMAIL:   [EMAIL]
  PASSWORD_RESET: [EMAIL]      # adding SMS later = add it here
```

**Package layout:**
```
com.ay.revisor.notification/
├── NotificationService, ChannelRouter, NotificationListener
├── channel/            EmailChannel            (v2+: SmsChannel)
├── render/             TemplateRenderer
├── transport/email/    EmailSender, EmailMessage, SmtpEmailSender
└── transport/sms/      (v2+) SmsSender, SmsMessage, <Provider>SmsSender
resources/templates/
├── email/  verify-email.html + .txt, password-reset.html + .txt
└── sms/    (v2+)
```

**How this maps to SOLID:**
- **S** — router decides *where*, renderer decides *what it says*, sender decides *how it
  travels*; none knows the others' internals.
- **O** — SMS = new `SmsChannel` + `SmsSender` + implementation + templates + one config
  line. No existing class is edited.
- **L** — any `NotificationChannel` / `EmailSender` implementation is substitutable
  (SMTP2GO → Brevo is config; Mailpit in dev; GreenMail in tests).
- **I** — separate `EmailSender` and `SmsSender`; a single `send(to, subject, body)` would
  force SMS to ignore `subject`.
- **D** — `auth` depends only on event types in `shared/`; concrete senders are wired by
  Spring config.

**Provider independence:** there is exactly one `EmailSender` implementation,
`SmtpEmailSender` (Spring `JavaMailSender`). Every transactional provider speaks SMTP, so
switching provider = changing `MAIL_HOST/PORT/USERNAME/PASSWORD` + DNS records. No
provider SDK, no provider-hosted templates, no provider click/open tracking. An HTTP-API
sender (e.g. for delivery webhooks) can be added later as a second implementation selected
by `app.mail.transport`, without touching callers.

**Failure handling (v1):** `@Async` executor with a small bounded pool (core 1, max 2 —
the e2-micro has 1 GB RAM); on SMTP failure, retry up to 3 times with backoff (Spring
Retry), then log an error (user id + type, no body). No persistent outbox in v1 — if the
process dies mid-send, the user uses "resend verification" / "forgot password" again.
Revisit with an outbox table only if lost emails become a real problem.

**Not built in v1:** SmsChannel, SmsSender, phone number on `User` — the structure just
leaves room for them (PRD.md §7).

## 9. Frontend
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
  /check-email                 — "we sent you a link" + resend (after signup / unverified login)
  /verify-email?token=…         — POSTs token, shows result
  /forgot-password              — request reset link
  /reset-password?token=…       — set new password
  /courses                    — course list
  /courses/:id                — topic tree for a course
  /subtopics/:id/review        — review-grading flow
  /dashboard                   — due today/this week, progress
  /admin/users                 — admin only, route-guarded by role
  ```
  Token pages read the token once, then `history.replaceState` it out of the URL
  (SECURITY.md).
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

## 10. Tech stack
- Backend: Spring Boot 4 (Java 25), Spring Data JPA, Spring Security, PostgreSQL, Flyway
- Auth: Nimbus JOSE+JWT (RS256), BCrypt (via `spring-security-crypto`), Bucket4j (rate limiting)
- Email: `spring-boot-starter-mail` (JavaMailSender over SMTP), Thymeleaf (templates),
  Spring Retry; SMTP2GO in production, Mailpit locally (see DEPLOYMENT.md)
- Mapping/validation: MapStruct, Bean Validation — plain Java, no Lombok
- API docs: springdoc-openapi (Swagger UI, gated/disabled in prod — see SECURITY.md)
- Observability: Spring Boot's structured logging (JSON in prod, see DEPLOYMENT.md),
  Spring Boot Actuator (`/actuator/health`, `/liveness`, `/readiness` — nothing else exposed)
- Testing: JUnit 5, Mockito, Testcontainers, GreenMail (in-process SMTP for email tests)
- Frontend: React + TypeScript, Vite, React Router, TanStack Query, Context API
- Infra: Docker + Docker Compose (no Kubernetes), Caddy reverse proxy (backend), GCP
  e2-micro Always Free tier (backend hosting — see DEPLOYMENT.md), Cloudflare Pages
  (frontend), GitHub Actions CI/CD
- Explicitly not used: Redis (no current job for it — see DEPLOYMENT.md), Kubernetes,
  Lombok, Redux, email-provider SDKs

## 11. Testing strategy

| Layer | Test type | Example |
|---|---|---|
| Pure logic (SM2Calculator, mappers, validators, token generation/hashing, ChannelRouter) | Unit, no Spring context | quality=4, ease=2.5 → assert new ease/interval; quality=2 → assert repetitions reset to 0; PASSWORD_RESET routes to [EMAIL] |
| Services (ownership rules, review-gating, token lifecycle) | Unit, mocked repositories | Review on never-learned subtopic → exception; repeat `/learn` call → no-op, not a new record; expired/used token → invalid-token; reset revokes all refresh tokens; new token invalidates older one |
| Repositories (ownership + dashboard queries, token redemption) | Integration, Testcontainers (real Postgres) | Confirms actual SQL/index behavior; concurrent redemption of one token succeeds once |
| Notification delivery | Integration, GreenMail SMTP server | Signup commit → exactly one email to the right address containing a link; rollback → no email; template renders |
| Controllers | Integration (MockMvc / full context) | Happy path + auth-required + 404-not-403; unverified login → 403 email-not-verified; forgot-password on unknown email → 202 |
| Frontend components/hooks | React Testing Library | Review-grading flow submits correct quality value; verify-email page posts token from URL |

"Done" per milestone = pure logic has unit tests, each new endpoint has at least one
integration test (happy path + main failure mode).

## 12. Open questions
- None currently. The domain is decided — `aydev.in` (registered at GoDaddy), with the
  frontend at `revisor.aydev.in` and the API at `api.revisor.aydev.in` (see DEPLOYMENT.md);
  backend hosting is GCP e2-micro free tier.