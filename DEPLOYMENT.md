# Prep Tracker — Deployment

Living document. See ARCHITECTURE.md §1/§5 for why this stays a single-VM, no-K8s,
no-Redis setup, and why that's still a "designed for scale" decision, not a shortcut.

## Local development — Docker Compose
```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: preptracker
      POSTGRES_USER: preptracker
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes: ["pgdata:/var/lib/postgresql/data"]

  backend:
    build: ./backend
    environment:
      SPRING_DATASOURCE_URL: jdbc:postgresql://postgres:5432/preptracker
      JWT_PRIVATE_KEY_PATH: /run/secrets/jwt_private.pem
      JWT_PUBLIC_KEY_PATH: /run/secrets/jwt_public.pem
    depends_on: [postgres]
    ports: ["8080:8080"]

  frontend:
    build: ./frontend
    ports: ["3000:3000"]

volumes:
  pgdata:
```
Secrets come from a local `.env` — gitignored, never committed.

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

## Production architecture
Same Docker Compose shape, plus **Caddy** as reverse proxy — gets automatic HTTPS
(Let's Encrypt) with minimal config, no manual cert renewal:
```
# Caddyfile
preptracker.yourdomain.com {
    reverse_proxy /api/* backend:8080
    reverse_proxy frontend:3000
}
```
Frontend served as a static build (not a Node dev server) via Caddy — much lighter.

## Hosting platform — open decision
Not yet finalized. Options discussed:
- **VPS (Hetzner/DigitalOcean, ~$5-6/mo)** + Docker Compose + Caddy — full control,
  genuine DevOps talking points for interviews (reverse proxy, CI/CD, backups).
- **GCP e2-micro (Always Free tier)** — permanently free (unlike AWS/Azure's 12-month-only
  free VMs), but only 1 GB RAM — requires JVM heap tuning (`-Xmx384m` or similar), a static
  (not dev-server) frontend build, and a 2 GB swap file as a safety margin.
- Oracle Cloud Always Free (outside AWS/Azure/GCP) noted as a more generous alternative if
  raw specs matter more than platform choice.
Decision deferred until later — not blocking further design work.

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

## CI/CD
GitHub Actions: build Docker images on push to `main`, push to GitHub Container Registry,
then SSH into the VPS/VM and `docker compose pull && docker compose up -d` (or a tool like
Watchtower for auto-pull).

## Backups
Postgres data in a named volume; a scheduled `pg_dump` (cron or a small scheduled
container) pushed to cheap object storage (e.g. Backblaze B2).

## Observability
Spring Boot Actuator (`/actuator/health`) as the healthcheck endpoint for Caddy/Docker.
Logback with JSON output in production (`logstash-logback-encoder`); plain text locally.
Docker's own log driver with rotation configured (`max-size`, `max-file`) — sufficient at
this scale, no ELK/Grafana Loki needed.

## Secrets in production
RSA key pair + DB password: VPS filesystem with restricted permissions, or the hosting
platform's secret store — never committed, never baked into the image.

## Open items
- Final hosting platform choice (VPS vs GCP free tier vs other).
