# Prep Tracker — Security Design

Living document. Covers auth, tokens, transport, and hardening decisions. See
ARCHITECTURE.md §4/§7 for how this ties into the ownership and admin model.

## Passwords
- **BCrypt** (Spring Security default), default strength (10 rounds). No custom hashing.
- Policy: minimum 8 characters (`@Size` on the signup DTO). No forced complexity rules —
  not worth the UX cost at this userbase size.

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

## Access + refresh tokens, with rotation
**Decision: short-lived access token + longer-lived refresh token, rotated on every use**
— not a single long-lived token. Rationale: a stolen access token self-expires fast; the
refresh token (the higher-value target) is rarely transmitted and rotates away from an
attacker on the legitimate user's next refresh, making theft detectable (reuse of a
rotated-away token is a strong compromise signal).

- Access token: 15 minutes, RS256 JWT.
- Refresh token: 14 days, opaque random string (not a JWT) — stored server-side as a
  **hash** (like a password) in the `refresh_tokens` table, never the raw value.
- On `/auth/refresh`: validate hash + not revoked + not expired → issue new access +
  refresh token pair → revoke the old refresh token. Reuse of a revoked token should be
  treated as a compromise signal (consider revoking the full token family for that user).
- Logout revokes the refresh token server-side; the access token naturally expires within
  15 minutes — an accepted tradeoff over maintaining an access-token blacklist.

## Token storage — httpOnly cookies
**Decision: httpOnly cookies, not localStorage**, for both access and refresh tokens —
localStorage is readable by any JS on the page (including injected XSS payloads);
httpOnly cookies are invisible to `document.cookie`.
```
Set-Cookie: refreshToken=<value>; HttpOnly; Secure; SameSite=Strict;
            Path=/api/v1/auth/refresh; Max-Age=1209600
```
- `HttpOnly` — the XSS protection.
- `Secure` — HTTPS only.
- `SameSite=Strict` — CSRF defense (cookies are sent automatically by the browser, which
  is the tradeoff of moving off bearer-token-in-header auth).
- Refresh token cookie scoped narrowly to `Path=/api/v1/auth/refresh`.

## CORS
`allowCredentials(true)` + an explicit origin allowlist (never `*` — browsers reject that
combination with credentialed requests anyway). Origins differ per environment
(`localhost:3000` for dev, real domain for prod) via Spring profiles. Frontend must send
`credentials: 'include'` (fetch) / `withCredentials: true` (axios) on every call.

## Rate limiting
Bucket4j, in-memory (fine for a single backend instance — see DEPLOYMENT.md). Targets the
classic brute-force/credential-stuffing surface:
- `/auth/login`: 5 attempts per email per 15 minutes → 429.
- `/auth/signup`: looser per-IP limit (~10/hour) against automated account creation.

## Secrets management
JWT signing private key, DB credentials: environment variables / local `.env` (gitignored)
in dev; VPS filesystem with restricted permissions or platform secret store in production
— never committed, never baked into a Docker image.

## Admin role
- `role` column on `User` (`USER`/`ADMIN`), granted **only via a one-time manual Flyway
  migration** promoting a known email — never a self-service or in-app action, since
  nothing in the app should be able to grant itself elevated privileges.
- Admin endpoints protected by `@PreAuthorize("hasRole('ADMIN')")`.
- Every admin action (view another user's data, disable/delete a user) logged to
  `AdminAction` (who, what, on whom, when) — auditable access to other users' data.

## Swagger/OpenAPI exposure
Generated via springdoc-openapi directly from controller code (can't drift from the real
API). In production: either disabled entirely (`springdoc.api-docs.enabled=false`) or kept
behind the same auth/IP restriction as the rest of the app — not left open on a public URL
by default.

## Logging discipline
Never log passwords, JWTs, or refresh tokens (raw or hashed) — applies especially to the
`auth` module. Request correlation ID (`X-Request-Id`, propagated via MDC) for tracing one
request's full log trail without needing to log sensitive payloads.

## Open items
- Whether disabling a user (admin action) also revokes their outstanding refresh tokens.
- Hard-delete cascade behavior for admin-initiated user deletion.
