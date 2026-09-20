# Revisor — Deployment

Living document. See ARCHITECTURE.md §1/§5 for why this stays a single-VM backend, no-K8s,
no-Redis setup, and why that's still a "designed for scale" decision, not a shortcut.

## Local development — Docker Compose (backend)
```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: revisor
      POSTGRES_USER: revisor
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes: ["pgdata:/var/lib/postgresql/data"]

  backend:
    build: ./backend
    environment:
      SPRING_DATASOURCE_URL: jdbc:postgresql://postgres:5432/revisor
      JWT_PRIVATE_KEY_PATH: /run/secrets/jwt_private.pem
      JWT_PUBLIC_KEY_PATH: /run/secrets/jwt_public.pem
    depends_on: [postgres]
    ports: ["8080:8080"]

volumes:
  pgdata:
```
Secrets come from a local `.env` — gitignored, never committed. The frontend runs
separately via `npm run dev` (Vite dev server) against this local backend — it is not
part of the backend's Docker Compose stack, matching how it's deployed in production (see
below).

**Backend Dockerfile — multi-stage build** (small final image, no build tools in prod):
```dockerfile
FROM eclipse-temurin:21-jdk AS build
WORKDIR /app
COPY . .
RUN ./mvnw clean package -DskipTests

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
ENTRYPOINT ["java", "-jar", "app.jar"]
```

## Backend production architecture
Docker Compose (Postgres + backend) plus **Caddy** as reverse proxy — gets automatic
HTTPS (Let's Encrypt) with minimal config, no manual cert renewal:
```
# Caddyfile
api.revisor.dev {
    reverse_proxy backend:8080
}
```
Caddy now only proxies the API — it no longer needs to serve any frontend static files
(see below), since the frontend is deployed independently.

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

**Build config:** the frontend needs `VITE_API_URL=https://api.<domain>` injected
at build time by Cloudflare Pages (per-environment: a different value for preview builds
if needed).

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
GitHub Actions: build Docker images on push to `main`, push to GitHub Container Registry,
then SSH into the GCP e2-micro instance and `docker compose pull && docker compose up -d`
(or a tool like Watchtower for auto-pull). Frontend deploys separately and automatically
via Cloudflare Pages (see above) — no shared pipeline between the two.

## Backups
Postgres data in a named volume; a scheduled `pg_dump` (cron or a small scheduled
container) pushed to cheap object storage (e.g. Backblaze B2). Worth keeping backup size
in mind on the e2-micro's limited local disk — push to object storage promptly rather
than accumulating dumps locally.

## Observability
Spring Boot Actuator (`/actuator/health`) as the healthcheck endpoint for Caddy/Docker.
Logback with JSON output in production (`logstash-logback-encoder`); plain text locally.
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