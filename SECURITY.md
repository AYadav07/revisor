# Revisor — Security Design

Living document. Covers auth, tokens, transport, and hardening decisions. See
ARCHITECTURE.md §4/§7 for how this ties into the ownership and admin model, and
DEPLOYMENT.md for how the frontend/backend split affects cookie behavior.

## Passwords
- **BCrypt** (Spring Security default), default strength (10 rounds). No custom hashing.
- Policy: minimum 8 characters (`@Size` on the signup DTO). No forced complexity rules —
  not worth the UX cost at this userbase size.
- No password-reset/"forgot password" flow in v1 — explicit non-goal, see PRD.md §4.
  Deferred to v2.

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
- Admin-disabling a user (see §Admin role below) also revokes the user's entire current
  token family, same mechanism as reuse-detection.

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
registrable domain via subdomains — e.g. `app.revisor.dev` and `api.revisor.dev`
— or the browser will not attach the auth cookies to API calls at all. A custom domain is
required for this architecture to work, not optional.

## CORS
`allowCredentials(true)` + an explicit origin allowlist (never `*` — browsers reject that
combination with credentialed requests anyway). Production origin is the exact frontend
domain (`https://app.revisor.dev`), not a platform-generated URL that can change.
Origins differ per environment (`localhost:5173` for local Vite dev) via Spring profiles.
Frontend must send `credentials: 'include'` (fetch) / `withCredentials: true` (axios) on
every call.

## Rate limiting
Bucket4j, in-memory (fine for a single backend instance — see DEPLOYMENT.md). Targets the
classic brute-force/credential-stuffing surface:
- `/auth/login`: 5 attempts per email per 15 minutes → 429.
- `/auth/signup`: looser per-IP limit (~10/hour) against automated account creation.

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
  spoof it and dodge the limit. The compose file's published `8080` is for local use; in
  production bind it to the Docker network only.

## Secrets management
JWT signing private key, DB credentials: environment variables / local `.env` (gitignored)
in dev; VPS filesystem with restricted permissions or platform secret store in production
— never committed, never baked into a Docker image.

## Admin role
- `role` column on `User` (`USER`/`ADMIN`), granted **only via a one-time manual Flyway
  migration** promoting a known email — never a self-service or in-app action, since
  nothing in the app should be able to grant itself elevated privileges.
- **Mechanism:** `backend/src/main/resources/db/migration/admin-bootstrap.sql.template` —
  copy it into `db/migration/postgresql/` as the next version (e.g. `V3__promote_initial_admin.sql`),
  fill in the real email, deploy once. It lives outside the migration folders Flyway actually
  scans and isn't even a `.sql` file, so it can never run on its own; turning it into a real,
  numbered migration is the deliberate human action. The target account must sign up normally
  first — this only promotes an existing row, it never creates one.
- Admin endpoints protected by `@PreAuthorize("hasRole('ADMIN')")`.
- **Disabling a user (`PATCH .../{id} { enabled: false }`) revokes their entire current
  refresh-token family** (see §Access + refresh tokens) — immediate logout everywhere,
  not just a block on future logins.
- **Deleting a user requires disabling first** — `DELETE /admin/users/{id}` returns `409
  Conflict` if the user is not already disabled. Once disabled, delete hard-cascades:
  user row, all courses/topics/subtopics, all review history, all refresh tokens for that
  user are permanently removed (see ARCHITECTURE.md §7).
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

## Actuator
Only `GET /actuator/health` (and the `/liveness` and `/readiness` probes) is exposed, publicly and
with no component details — enough for Caddy/Docker health checks, nothing about the environment.
Every other endpoint (`env`, `beans`, `metrics`, `heapdump`, ...) is not exposed at all.

## Logging discipline
Never log passwords, JWTs, or refresh tokens (raw or hashed) — applies especially to the
`auth` module. Request correlation ID (`X-Request-Id`, propagated via MDC) for tracing one
request's full log trail without needing to log sensitive payloads.
`RequestIdFilter` runs ahead of Spring Security so even rejected requests are correlated: it keeps a
caller's `X-Request-Id` only if it matches `[A-Za-z0-9._-]{1,64}` (it goes into logs and a response
header, so anything else could forge log lines or inject headers), otherwise generates a UUID. The
id is in every log line as `requestId` and echoed on the response.

## Open items
None currently.