# Revisor — Security Design

Living document. Covers auth, tokens, email verification/password reset, transport, and
hardening decisions. See ARCHITECTURE.md §4/§7/§8 for how this ties into the ownership,
admin and notification model, and DEPLOYMENT.md for how the frontend/backend split affects
cookie behavior and how email is delivered.

## Passwords
- **BCrypt** (Spring Security default), default strength (10 rounds). No custom hashing.
- Policy: minimum 8 characters (`@Size` on the signup and reset-password DTOs). No forced
  complexity rules — not worth the UX cost at this userbase size.
- Password reset via emailed single-use link — see §Email verification & password reset.

## JWT signing — RS256
**Decision: RS256, not HS256** — deliberately chosen over the "simpler" HS256 default,
because the private key (signing) and public key (verification) are separable. Only the
`auth` module ever holds the private key; every other module (and any future extracted
service) only ever needs the public key to verify. If `auth` is ever split into its own
service, verification logic elsewhere doesn't change at all.
- RSA key pair, 2048-bit minimum. Private key path via env var, never committed. Public
  key can be distributed more freely (it's not sensitive).
- Library: Nimbus JOSE+JWT.
- JWT claims kept minimal: `sub` (user id), `email`, `role`, `iat`, `exp`.

## Access + refresh tokens, with rotation and family tracking
**Decision: short-lived access token + longer-lived refresh token, rotated on every use**
— not a single long-lived token. Rationale: a stolen access token self-expires fast; the
refresh token (the higher-value target) is rarely transmitted and rotates away from an
attacker on the legitimate user's next refresh, making theft detectable (reuse of a
rotated-away token is a strong compromise signal).

- Access token: 15 minutes, RS256 JWT.
- Refresh token: 14 days, opaque random string (not a JWT) — stored server-side as a
  **hash** (like a password) in the `refresh_tokens` table, never the raw value.
- **Token family:** every refresh token carries a `family_id` — the same value across all
  tokens descended from one login (the first token issued at login generates a new
  `family_id`; each rotation carries it forward to the replacement token).
- On `/auth/refresh`: validate hash + not revoked + not expired → issue new access +
  refresh token pair (same `family_id`) → revoke the old refresh token.
- **Reuse of a revoked token revokes the whole family.** If a refresh token that has
  already been rotated away (revoked) is presented again, this is treated as a compromise
  signal: every `RefreshToken` row sharing that `family_id` is immediately revoked,
  logging the legitimate user out everywhere and forcing a fresh login. This is a
  deliberate, not merely "considered," behavior — the schema (`family_id` column, see
  ARCHITECTURE.md §2) is designed for it from the first migration.
- Logout revokes the refresh token server-side; the access token naturally expires within
  15 minutes — an accepted tradeoff over maintaining an access-token blacklist.
- Admin-disabling a user (see §Admin role below) also revokes *every* refresh token
  belonging to that user — every family, not just their most recent login, so a second
  device or browser session doesn't stay logged in after a disable. Uses the same bulk
  revoke mechanism as reuse-detection, scoped by user rather than by family.
- A successful password reset revokes **all** of the user's refresh tokens (every family)
  with the same by-user bulk revoke — see below.

## Email verification & password reset
**Decision: emailed single-use links carrying an opaque random token**, not OTP codes
(no attempt-counting needed, one click for the user) and not JWTs (a JWT can't be revoked
or marked used without server-side state anyway, so an opaque token + DB row is simpler).

**Token design** (one table, `email_token`, for both purposes — ARCHITECTURE.md §2):
- 32 bytes from `SecureRandom`, Base64URL-encoded → sent in the link.
- Stored only as a **SHA-256 hash** (`token_hash`), never the raw value — same principle as
  refresh tokens. SHA-256 rather than BCrypt is fine here because the token is 256 bits
  of randomness (not guessable), and lookups need a deterministic hash.
- `purpose`: `VERIFY_EMAIL` | `RESET_PASSWORD`. A token is only valid for its own purpose.
- Expiry: `VERIFY_EMAIL` 24 hours, `RESET_PASSWORD` 30 minutes.
- **Single-use:** `used_at` is set on redemption; redemption is a conditional update
  (`... WHERE token_hash = ? AND used_at IS NULL AND expires_at > now()`) so two
  concurrent clicks can't both succeed.
- **Issuing a new token invalidates older unused tokens** of the same purpose for that
  user — only the latest link works.
- Expired/used tokens are purged by a daily `@Scheduled` job.

**Links point at the frontend, never at a GET API endpoint.** The email links to
`https://revisor.aydev.in/verify-email?token=…` (or `/reset-password?token=…`); that page
POSTs the token to `api.revisor.aydev.in`. Email security scanners (Outlook Safe Links,
Gmail) prefetch GET links in emails, which would silently consume a token on a GET endpoint.
- The page reads the token once and replaces the URL (`history.replaceState`) so it doesn't
  linger in history. `_headers` sets `Referrer-Policy: no-referrer` on those two paths
  (stricter than the site-wide policy below), so the token never leaks via Referer.
- Provider click-tracking must be **off** (see DEPLOYMENT.md) — it would rewrite these
  links through a third-party redirect domain.

**Unverified accounts cannot log in.** `/auth/login` returns `403` with
`type=.../errors/email-not-verified` — but only *after* the password check succeeds, so
the response never reveals verification state (or existence) to someone who doesn't know
the password. The frontend then offers "resend verification email".

**No account enumeration.** `/auth/forgot-password` and `/auth/resend-verification`
always return `202` with the same body, whether the email exists or not, and do the same
amount of synchronous work (email sending is async anyway, so timing doesn't differ).
Signup still returns `409` for a taken email — accepted tradeoff, since signup
enumeration is rate-limited and a friendly "already registered" message matters more at
this scale.

**Password reset side effects:**
- New password BCrypt-hashed; token marked used.
- **All** of the user's refresh tokens revoked (every family) — an attacker holding a
  session is logged out the moment the real owner resets.
- `email_verified_at` set if it was null — completing a reset proves inbox ownership.
- The user is **not** auto-logged-in; they sign in with the new password.
- Disabled accounts: forgot-password silently sends nothing; reset/verify with a token
  belonging to a disabled user returns the same `invalid-token` error.

**Existing accounts at rollout:** the Flyway migration adding `email_verified_at` sets it
to `created_at` for all pre-existing users, so nobody is locked out.

## Token storage — httpOnly cookies
**Decision: httpOnly cookies, not localStorage**, for both access and refresh tokens —
localStorage is readable by any JS on the page (including injected XSS payloads);
httpOnly cookies are invisible to `document.cookie`.

**Production:**
```
Set-Cookie: refreshToken=<value>; HttpOnly; Secure; SameSite=Strict;
            Path=/api/v1/auth; Max-Age=1209600
```
- `HttpOnly` — the XSS protection.
- `Secure` — HTTPS only.
- `SameSite=Strict` — CSRF defense (cookies are sent automatically by the browser, which
  is the tradeoff of moving off bearer-token-in-header auth).
- Refresh token cookie scoped to `Path=/api/v1/auth` — the auth endpoints only, not the whole
  API. This was originally `/api/v1/auth/refresh`, but a cookie is only sent to URLs under its
  path, so that would never reach `/auth/logout` and logout couldn't revoke the token
  server-side. `/api/v1/auth` is the narrowest path that covers both. The access token cookie
  is `Path=/`.
- Cookie flags come from `app.cookies.secure` (default `true`; `local`/`dev` set `false`).
- JWT key pair: `app.jwt.private-key-path` / `public-key-path` (env `JWT_PRIVATE_KEY_PATH` /
  `JWT_PUBLIC_KEY_PATH`), PKCS#8 / X.509 PEM. The `local` profile alone sets
  `app.jwt.generate-ephemeral-keys` to mint a throwaway pair per start; any other profile
  without key paths fails at startup.

**Local/dev profile:** `Secure` is omitted. Local dev runs frontend (`localhost:5173`,
Vite) and backend (`localhost:8080`, Spring) both over plain HTTP — a `Secure` cookie is
never set or sent over HTTP, so keeping the flag on in dev would silently break auth on
every local run. Cookie flags are driven by Spring profile (`local`/`dev` vs `prod`), not
a single hardcoded `Set-Cookie` value:
```
# application-local.yml (illustrative)
app.cookies.secure: false
# application-prod.yml
app.cookies.secure: true
```
`HttpOnly` and `SameSite=Strict` stay on in both profiles — only `Secure` differs. This is
a deliberate, scoped divergence from prod behavior for local development convenience, not
a general security relaxation.

**Consequence of the frontend/backend split (see DEPLOYMENT.md):** `SameSite=Strict`
cookies are only sent on same-site requests, where "site" means the registrable domain
(eTLD+1). Frontend (Cloudflare Pages) and backend (its own VM) must therefore share one
registrable domain via subdomains — `revisor.aydev.in` and `api.revisor.aydev.in`, both
under `aydev.in` — or the browser will not attach the auth cookies to API calls at all. A custom domain is
required for this architecture to work, not optional.

## CORS
`allowCredentials(true)` + an explicit origin allowlist (never `*` — browsers reject that
combination with credentialed requests anyway). Production origin is the exact frontend
domain (`https://revisor.aydev.in`), not a platform-generated URL that can change.
Origins differ per environment (`localhost:5173` for local Vite dev) via Spring profiles.
Frontend must send `credentials: 'include'` (fetch) / `withCredentials: true` (axios) on
every call.

## Rate limiting
Bucket4j, in-memory (fine for a single backend instance — see DEPLOYMENT.md). Targets the
classic brute-force/credential-stuffing surface, and every endpoint that costs an email:
- `/auth/login`: 5 attempts per email per 15 minutes → 429.
- `/auth/signup`: looser per-IP limit (~10/hour) against automated account creation.
- `/auth/resend-verification` and `/auth/forgot-password`: 3 per email per hour **and**
  ~10 per IP per hour → 429. Protects users' inboxes from being spammed and protects the
  Resend free quota (100/day, 3,000/month — DEPLOYMENT.md). A rate-limited request gets
  the 429 (not the usual 202), which reveals nothing about whether the email exists.
- `/auth/verify-email` and `/auth/reset-password`: ~20 per IP per hour (tokens are
  unguessable; this just caps noise).

Implementation notes:
- **Every** login attempt counts, successful or not, and the email is trimmed and lower-cased
  first so `Ann@X.com` and `ann@x.com` share one bucket. Requests rejected by validation (400)
  don't count. Buckets refill in full once the window has passed.
- The 429 is a Problem Details response with a `Retry-After` header (seconds).
- Buckets live in size-bounded, expiring caches (Caffeine), so cycling through emails or IPs can't
  grow memory without limit.
- **The signup limit keys on the client IP, which only works if the backend sees the real one.**
  Behind Caddy the socket peer is always Caddy, so the `prod` profile sets
  `server.forward-headers-strategy: native` to honour `X-Forwarded-For`. That header is only
  trustworthy if nothing but the proxy can reach the backend port — otherwise a client could
  spoof it and dodge the limit. In production (`deploy/compose.yaml`) the backend publishes
  no port at all — only Caddy is reachable, and it replaces any client-sent `X-Forwarded-For`.

## Secrets management
JWT signing private key, DB credentials, SMTP credentials: environment variables / local
`.env` (gitignored) in dev; VPS filesystem with restricted permissions or platform secret
store in production — never committed, never baked into a Docker image. The SMTP password
is a Resend **API key with sending access only**, created just for Revisor (revocable on its
own) — never a full-access key.
The `dev` profile reads its pair from `backend/secrets/` by default (gitignored, created once by
`backend/scripts/generate-jwt-keys.sh`, private key `0600`); `JWT_PRIVATE_KEY_PATH` /
`JWT_PUBLIC_KEY_PATH` override it. At startup the pair is rejected unless it is at least 2048 bits
and the public key matches the private one.

## Admin role
- `role` column on `User` (`USER`/`ADMIN`), granted **only via a one-time manual Flyway
  migration** promoting a known email — never a self-service or in-app action, since
  nothing in the app should be able to grant itself elevated privileges.
- **Mechanism:** `backend/src/main/resources/db/migration/admin-bootstrap.sql.template` —
  copy it into `db/migration/postgresql/` as the next free version (e.g. `V4__promote_initial_admin.sql`
  once the email-verification migration has taken `V3`),
  fill in the real email, deploy once. It lives outside the migration folders Flyway actually
  scans and isn't even a `.sql` file, so it can never run on its own; turning it into a real,
  numbered migration is the deliberate human action. The target account must sign up normally
  first — this only promotes an existing row, it never creates one.
- Admin endpoints protected by `@PreAuthorize("hasRole('ADMIN')")`.
- **Disabling a user (`PATCH .../{id} { enabled: false }`) revokes every refresh token
  belonging to them, across every family** (see §Access + refresh tokens) — immediate
  logout everywhere (every device, every session), not just a block on future logins.
- **An admin cannot disable or delete their own account** — `409 Conflict`, the same
  status as the "target still enabled" case below. Other admins are not protected from
  each other.
- **Deleting a user requires disabling first** — `DELETE /admin/users/{id}` returns `409
  Conflict` if the user is not already disabled. Once disabled, delete hard-cascades:
  user row, all courses/topics/subtopics, all review history, all refresh tokens and
  email tokens for that user are permanently removed (see ARCHITECTURE.md §7).
- Every admin action (view another user's data, disable/delete a user) logged to
  `AdminAction` (who, what, on whom, when) — auditable access to other users' data.

## Swagger/OpenAPI exposure
Generated via springdoc-openapi directly from controller code (can't drift from the real
API). In production: either disabled entirely (`springdoc.api-docs.enabled=false`) or kept
behind the same auth/IP restriction as the rest of the app — not left open on a public URL
by default.

**Decision: disabled in production.** `application-prod.yaml` sets `springdoc.api-docs.enabled` and
`springdoc.swagger-ui.enabled` to `false`; local/dev serve `/v3/api-docs` and `/swagger-ui.html`.
The security chain only permits those paths while springdoc is enabled, so in production they are
ordinary protected URLs (401), not open holes.

## Frontend security headers
Cloudflare Pages serves the app with the headers in `dist/_headers`, generated at build time by
`frontend/scripts/cloudflarePages.ts` (so the API origin comes from `VITE_API_URL`, never hand-edited):
- **Content-Security-Policy** — `script-src 'self'` (no inline scripts, no eval), `connect-src` limited
  to the app itself and the API origin, fonts only from Google Fonts, `object-src 'none'`,
  `frame-ancestors 'none'`, `base-uri`/`form-action 'self'`. `style-src` allows `'unsafe-inline'`
  because the toast library injects a `<style>` element; that is the one relaxation. Zod runs in
  `jitless` mode (`src/lib/zodConfig.ts`) so it never probes for eval.
- **Strict-Transport-Security** (1 year, this host only), **X-Content-Type-Options: nosniff**,
  **X-Frame-Options: DENY**, **Referrer-Policy: strict-origin-when-cross-origin**, and a
  Permissions-Policy that turns off camera, microphone, geolocation and payment.

Verified by loading the built app in headless Chrome behind these headers and listening for
`securitypolicyviolation` events: none on load or form validation (a deliberately stricter control
policy did report violations, so the check is live). A Cloudflare build without an `https://`
`VITE_API_URL` fails instead of shipping an app that points at `localhost`.

## Actuator
Only `GET /actuator/health` (and the `/liveness` and `/readiness` probes) is exposed, publicly and
with no component details — enough for Caddy/Docker health checks, nothing about the environment.
Every other endpoint (`env`, `beans`, `metrics`, `heapdump`, ...) is not exposed at all.

## Logging discipline
Never log passwords, JWTs, refresh tokens, or email verification/reset tokens (raw or
hashed) — applies especially to the `auth` and `notification` modules. The notification
module logs user id + notification type + outcome only, never the rendered body (it
contains the token link). Request correlation ID (`X-Request-Id`, propagated via MDC) for tracing one
request's full log trail without needing to log sensitive payloads.
`RequestIdFilter` runs ahead of Spring Security so even rejected requests are correlated: it keeps a
caller's `X-Request-Id` only if it matches `[A-Za-z0-9._-]{1,64}` (it goes into logs and a response
header, so anything else could forge log lines or inject headers), otherwise generates a UUID. The
id is in every log line as `requestId` and echoed on the response.
Security-relevant events are logged by user id only: signup, login success and failure (unknown email
/ wrong password / disabled account / unverified email), email verified, password reset requested
and completed, refresh-token reuse (`WARN`), rate-limit hits (`WARN`; the
signup limit's client IP is logged, the login limit's email is not), and every admin action
(alongside its `AdminAction` row). An unhandled exception is logged at `ERROR` with its stack trace
and answered with a generic 500 that exposes none of it (API.md).

## Open items
None currently.