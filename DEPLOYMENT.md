# Revisor — Deployment

Living document. See ARCHITECTURE.md §1/§5 for why this stays a single-VM backend, no-K8s,
no-Redis setup, and why that's still a "designed for scale" decision, not a shortcut.

## Local development — Docker Compose (backend)
`backend/docker-compose.yml` runs just PostgreSQL for local development (password from the
gitignored `backend/.env`); the backend itself runs with `./gradlew bootRun` on the `dev` profile
and the frontend with `npm run dev` — see the root README.md. The frontend is never part of a
Compose stack, matching how it's deployed in production (see below).

**Backend image — `backend/Dockerfile`**, multi-stage: an `eclipse-temurin:25-jdk` stage runs
`./gradlew bootJar` (dependencies cached in their own layer; tests are not run here — CI runs
them first) and extracts Spring Boot's layers; the final `eclipse-temurin:25-jre` stage carries
only the JRE and those layers, and runs as an unprivileged fixed uid (`10001`). A code-only change
re-ships a layer of under 1 MB. `backend/.dockerignore` keeps `secrets/`, `.env` and `*.pem` out of
the build context, so no secret can land in an image layer.

## Backend production architecture
Docker Compose (Postgres + backend) plus **Caddy** as reverse proxy — gets automatic
HTTPS (Let's Encrypt) with minimal config, no manual cert renewal. The stack is defined in
`deploy/` (`compose.yaml`, `Caddyfile`, `.env.example`), with the one-time VM setup and day-to-day
operations in `deploy/README.md`:
```
# deploy/Caddyfile
{$API_DOMAIN} {
    reverse_proxy backend:8080
}
```
- The domain comes from `API_DOMAIN` in the VM's `.env`, so choosing it (Open items) is a config
  change, not a code change.
- Only Caddy publishes ports (80/443). The backend has none — so `X-Forwarded-For`, trusted for the
  signup rate limit, can only come from Caddy, which replaces any client-sent value (verified: a
  spoofed header does not bypass the limit). Postgres is on a separate network Caddy can't reach.
- JWT keys are bind-mounted read-only from `secrets/` on the VM; `.env` holds the DB password,
  domain and CORS origin. Neither is ever in git or an image.
- Memory limits per container (backend 700 MB with `-Xmx384m`, Postgres 256 MB with conservative
  settings, Caddy 128 MB), `restart: unless-stopped`, healthchecks on all but Caddy, and rotated
  `json-file` logs (3 × 10 MB per container).

Caddy only proxies the API — it serves no frontend files, since the frontend is deployed
independently.

## Backend hosting platform — decided: GCP e2-micro (Always Free tier)
**Decision: GCP e2-micro, Always Free tier.** Permanently free (unlike AWS/Azure's
12-month-only free VMs) — the right tradeoff for a small-userbase project where $0/mo
recurring cost matters more than headroom.

**Consequence: 1 GB RAM is tight, and this drives concrete config choices:**
- JVM heap tuning required: run the backend with an explicit bounded heap
  (`-Xmx384m -Xss256k` or similar — tune against actual measured usage once running,
  not guessed upfront) rather than the JVM's default heap sizing, which would assume far
  more available RAM than the instance has.
- A **2 GB swap file** as a safety margin against OOM kills, since Postgres + the JVM +
  Caddy all share the same 1 GB instance.
- Keep Postgres's own memory settings (`shared_buffers`, `work_mem`) conservative — the
  defaults tuned for larger instances will over-allocate here.
- Docker Compose stays the deployment mechanism (per ARCHITECTURE.md §1) — no change to
  that decision, just tighter resource limits on the containers than a paid VPS would need.

Oracle Cloud Always Free (more generous specs) was considered as an alternative but not
chosen — GCP was picked for familiarity/ecosystem fit. Revisit only if the 1 GB ceiling
becomes a real operational problem, not preemptively.

## Frontend deployment — Cloudflare Pages, separate from the backend
**Decision: the React frontend is hosted separately from the backend**, on Cloudflare
Pages, rather than being built and served as static files from the same VM/Caddy setup.
Rationale: a dedicated static host gives free global CDN distribution and automatic
deploy-on-push, without adding any load to the backend VM — which matters more now given
the e2-micro's 1 GB RAM ceiling above.

**Required consequence — a custom domain.** Because auth cookies are `SameSite=Strict`
(SECURITY.md), the frontend and backend must share one registrable domain via subdomains:
- Frontend: `app.<domain>` → CNAME to Cloudflare Pages
- Backend: `api.<domain>` → A record to the backend VM

Using each platform's default domain (e.g. `revisor.pages.dev` + a bare VM IP) would
silently break auth — cross-site `SameSite=Strict` cookies are simply never sent. A custom
domain (~$10-12/year) is therefore a required piece of infrastructure for this
architecture, not a nice-to-have.

**Domain name: not yet finalized** — `revisor.dev` is used throughout this doc set as a
placeholder/working example only. Final choice depends on checking availability and
pricing across registrars; decided later, before the deploy milestone (PRD.md §6,
milestone 10). Buying through Cloudflare Registrar (if the chosen domain is available
there) keeps DNS for both subdomains in one dashboard, but this isn't a hard requirement —
any registrar works as long as DNS can point `app.` and `api.` subdomains at Cloudflare
Pages and the backend VM respectively.

**Build config** (Pages project settings — full steps in `frontend/README.md`): root directory
`frontend`, build command `npm run build`, output directory `dist`, Node from `frontend/.nvmrc`.
`VITE_API_URL=https://api.<domain>` is injected at build time; the build **fails** on Cloudflare if it
is missing or not `https://` (`frontend/scripts/cloudflarePages.ts`), rather than shipping an app that
calls `localhost`. The same build step writes `dist/_headers`: the CSP and other security headers
(SECURITY.md), with `connect-src` derived from `VITE_API_URL`, and long-lived caching for the
content-hashed `/assets/*`. With no `404.html` in the output, Pages serves `index.html` for every
unknown path, which is the SPA fallback React Router needs.

**Preview deployments** (`<hash>.<project>.pages.dev`) build fine but can't sign in: they aren't on
the custom domain, so the `SameSite=Strict` cookies are never sent and the backend's CORS allowlist
doesn't include them. Use them for visual review only.

**Deploy flow:** Cloudflare Pages watches the repo directly and rebuilds/redeploys on
every push to `main` (or a configured branch) — no custom CI/CD pipeline needed for the
frontend, unlike the backend's GitHub Actions → VPS flow below.

## Kubernetes: not used
Solves orchestration-at-scale problems (rolling deploys across many instances,
auto-scaling, service mesh) this project doesn't have. Docker Compose on one VM already
handles restart-on-crash and easy redeploys at this scale.

## Redis: not used
Every place Redis could plausibly show up already has a simpler answer at this scale:
- Rate limiting (Bucket4j) — in-memory is fine with a single backend instance.
- Refresh tokens — stored in Postgres, not Redis.
- Caching — nothing in the app is expensive enough yet to need it; revisit only if a
  specific query is measurably slow under real load.
- Sessions — not applicable (stateless JWT).

## CI/CD (backend)
GitHub Actions (`.github/workflows/backend.yml`), triggered by changes under `backend/`, `deploy/`
or the workflow itself:
1. **test** — every PR and push: `./gradlew test -PincludePostgresTests` (the Testcontainers suites
   included; the runner has Docker).
2. **image** — push to `main` only, after tests pass: build and push
   `ghcr.io/ayadav07/revisor-backend`, tagged `latest` and the commit SHA (for rollback).
3. **deploy** — in the `production` environment: copy `deploy/compose.yaml` and `deploy/Caddyfile` to
   the VM over SSH (host key pinned from a secret, never keyscanned at deploy time), log the VM in to
   GHCR with the job's short-lived token, `docker compose pull && docker compose up -d`, log out, and
   fail the run unless `https://$API_DOMAIN/actuator/health` reports `UP` within five minutes.

Push-based over SSH rather than Watchtower: deploys are tied to a green test run and show up (with
their health result) in the Actions history, and no long-lived registry credential lives on the VM. Frontend deploys separately and automatically
via Cloudflare Pages (see above) — no shared pipeline between the two.

## Backups
Postgres data lives in a named volume; `deploy/backup.sh`, run nightly by a systemd timer on the
VM (`deploy/systemd/`), backs it up to object storage (Backblaze B2 or any S3-compatible store —
setup and restore in `deploy/README.md`):
1. `pg_dump --format=custom --compress=0` to a local file, then `pg_restore --list` on it — a failed
   or truncated dump fails the run instead of being saved.
2. **restic** (official image, run on demand from the compose file's `backup` profile — never
   started by `docker compose up`) uploads it as an encrypted snapshot. Encryption happens on the VM,
   so the provider never sees user data. Uncompressed dumps let restic deduplicate unchanged tables
   between nights, so storage grows with changes rather than database size.
3. Retention: 7 daily, 4 weekly, 6 monthly snapshots, pruned each run; a weekly `restic check` reads
   back a 10% sample of the stored data.
4. The local dump is deleted immediately — nothing accumulates on the e2-micro's small disk.
5. An optional dead-man's-switch ping (`BACKUP_PING_URL`, e.g. healthchecks.io) alerts when a night
   passes without a successful backup.

The encryption password must also be kept outside the VM (a password manager) — without it the
backups can't be read. The restore procedure was verified end to end: the Postgres volume of a local
copy of the stack was destroyed and restored from a snapshot, with logins, data and ID sequences
intact.

## Observability
Spring Boot Actuator (`/actuator/health`, plus `/actuator/health/liveness` and `/readiness`) as the
healthcheck endpoint for Caddy/Docker — public, no details; nothing else is exposed.
JSON logs in production via Spring Boot's built-in structured logging (`logging.structured.format.console:
ecs`, set in `application-prod.yaml`) rather than `logstash-logback-encoder` — same result, one less
dependency. Each record carries the `requestId` from the `X-Request-Id` correlation header. Plain text
locally.

### Production profile (`SPRING_PROFILES_ACTIVE=prod`)
All environment-specific values come from env vars; the app fails at startup if any is missing:
`SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD`,
`JWT_PRIVATE_KEY_PATH`, `JWT_PUBLIC_KEY_PATH` (PKCS#8 / X.509 PEM files), and
`APP_CORS_ALLOWED_ORIGINS` (comma-separated exact origins, e.g. the `app.` subdomain). `deploy/compose.yaml`
sets them all from the VM's `.env` and `secrets/`. `prod` also turns Swagger off, forces `Secure` cookies, and trusts
`X-Forwarded-For` from the proxy for the signup rate limit — see SECURITY.md.
Docker's own log driver with rotation configured (`max-size`, `max-file`) — sufficient at
this scale, no ELK/Grafana Loki needed, and lighter-weight logging matters more on a 1 GB
instance. Frontend errors: Cloudflare Pages' own build/deploy logs are sufficient at this
scale — no separate frontend error-tracking service needed yet.

## Secrets in production
RSA key pair + DB password: GCP instance filesystem with restricted permissions, or GCP
Secret Manager — never committed, never baked into the image. Frontend build-time
env vars (`VITE_API_URL`) are not secret and are set directly in Cloudflare Pages' project
config.

## Open items
- Final domain name and registrar — pending an availability/pricing check. Every `revisor.dev`
  reference in this doc set (and `app.revisor.dev` / `api.revisor.dev` in SECURITY.md,
  ARCHITECTURE.md) is a placeholder to swap for the real domain once chosen; the
  subdomain-split architecture itself does not change based on which name is picked.