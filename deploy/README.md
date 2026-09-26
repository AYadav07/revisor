# Backend deployment

Production runs on one GCP e2-micro VM (DEPLOYMENT.md): **Caddy** (HTTPS on 80/443) → **backend**
→ **PostgreSQL**, all in Docker Compose. This folder is the stack definition:

| File | What it is |
|---|---|
| `compose.yaml` | The three services, memory limits, networks, log rotation |
| `Caddyfile` | Reverse proxy for `$API_DOMAIN`, automatic Let's Encrypt certificate |
| `.env.example` | Template for the VM's `.env` (secrets and domain — never committed) |

CI (`.github/workflows/backend.yml`) tests every PR and push. On a push to `main` it builds the image,
pushes it to `ghcr.io/ayadav07/revisor-backend` (tagged `latest` and the commit SHA), copies
`compose.yaml` and `Caddyfile` to the VM, pulls and restarts, then waits for
`https://$API_DOMAIN/actuator/health` to report `UP`.

On the VM, the deploy directory (`/opt/revisor` by default) holds:

```
/opt/revisor/
├── compose.yaml      # copied by CI on every deploy
├── Caddyfile         # copied by CI on every deploy
├── .env              # created once by you, chmod 600
└── secrets/
    ├── jwt_private.pem   # owned by uid 10001, chmod 600
    └── jwt_public.pem
```

## One-time setup

### 1. The VM

1. Create an **e2-micro** instance in a free-tier region (`us-west1`, `us-central1` or `us-east1`),
   Ubuntu 24.04 LTS, 30 GB standard persistent disk.
2. Reserve a **static external IP** for it, so the DNS record below never goes stale (check GCP's
   current pricing for external IPs).
3. Firewall: allow inbound **TCP 80, TCP 443 and UDP 443** (HTTP/3) from anywhere, and SSH (22)
   only from where you need it. Nothing else — Postgres and the backend are never exposed.

### 2. DNS

Once the domain is chosen (DEPLOYMENT.md "Open items"): an **A record** `api.<domain>` → the VM's
static IP. The frontend's `app.<domain>` points at Cloudflare Pages separately. Caddy can only get a
certificate after this record resolves.

### 3. Prepare the VM

SSH in, then:

```bash
# 2 GB swap: headroom against OOM kills with Postgres + JVM + Caddy in 1 GB (DEPLOYMENT.md)
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Docker Engine + the Compose plugin (https://docs.docker.com/engine/install/ubuntu/)
curl -fsSL https://get.docker.com | sudo sh

# A dedicated user for CI deploys. Note: membership of the docker group is root-equivalent.
sudo adduser --disabled-password --gecos '' deploy
sudo usermod -aG docker deploy
sudo install -d -o deploy -g deploy -m 750 /opt/revisor
```

### 4. Secrets on the VM

As the `deploy` user, in `/opt/revisor`:

```bash
# .env — fill in DB_PASSWORD (openssl rand -base64 32), API_DOMAIN, APP_CORS_ALLOWED_ORIGINS
cp /dev/null .env && chmod 600 .env && nano .env      # contents: see deploy/.env.example

# JWT signing keys (2048-bit RSA, PKCS#8 + X.509 PEM). Generated on the VM, never copied around.
install -d -m 750 secrets
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out secrets/jwt_private.pem
openssl pkey -in secrets/jwt_private.pem -pubout -out secrets/jwt_public.pem
# The container runs as uid 10001 and must be able to read the private key — and no one else.
sudo chown 10001:10001 secrets/jwt_private.pem secrets/jwt_public.pem
sudo chmod 600 secrets/jwt_private.pem && sudo chmod 644 secrets/jwt_public.pem
sudo chgrp 10001 secrets && sudo chmod 750 secrets
```

### 5. The CI deploy key

On your own machine:

```bash
ssh-keygen -t ed25519 -N '' -C 'github-actions-deploy' -f revisor_deploy
```

- Append `revisor_deploy.pub` to `/home/deploy/.ssh/authorized_keys` on the VM (dir `700`, file
  `600`, owned by `deploy`).
- The VM's host key, for pinning: run `ssh-keyscan -t ed25519 <vm-ip>` and check its fingerprint
  (`ssh-keygen -lf -` on that output) against `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub`
  run **on the VM**. Only a matching line goes into `DEPLOY_KNOWN_HOSTS`.

### 6. GitHub configuration

Repository → Settings → Environments: create **`production`** (optionally with required reviewers,
to approve each deploy). Then under Secrets and variables → Actions:

| Kind | Name | Value |
|---|---|---|
| secret | `DEPLOY_HOST` | The VM's static IP (or a DNS name for it) |
| secret | `DEPLOY_USER` | `deploy` |
| secret | `DEPLOY_SSH_KEY` | Contents of the private key `revisor_deploy` |
| secret | `DEPLOY_KNOWN_HOSTS` | The verified `ssh-keyscan` line from step 5 |
| variable | `API_DOMAIN` | e.g. `api.revisor.dev` — used for the post-deploy health check |
| variable | `DEPLOY_DIR` | Optional; defaults to `/opt/revisor` |

Then push to `main` (or run the workflow by hand: Actions → Backend → Run workflow). The first
start takes a minute or two: Flyway creates the schema and Caddy obtains the certificate.

### 7. The first admin

Sign up through the app, then promote that account with a Flyway migration as described in
`backend/src/main/resources/db/migration/admin-bootstrap.sql.template`. Commit it; the next deploy
applies it.

## Operations

All from `/opt/revisor` on the VM as `deploy`:

```bash
docker compose ps                         # status and health of all three
docker compose logs -f --tail 100 backend # JSON logs; find one request by its X-Request-Id
docker compose restart backend
docker stats --no-stream                  # memory against the limits in compose.yaml
docker compose exec postgres psql -U revisor -d revisor
```

**Manual pulls** (rollback, restart after a reboot needing a fresh image) need a GHCR login on the VM,
since CI logs out after each deploy. Use a personal access token with only `read:packages`:
`docker login ghcr.io -u <github-user>`, then `docker logout ghcr.io` when done.

**Roll back** to an earlier build: every image is also tagged with its commit SHA.

```bash
echo 'BACKEND_TAG=<commit-sha>' >> .env
docker compose pull backend && docker compose up -d
```

Remove the `BACKEND_TAG` line again once a fixed build is on `main` — while it's set, CI deploys
keep running the pinned version.

**Rotate the JWT keys** (e.g. suspected leak): regenerate both files as in step 4, then
`docker compose restart backend`. Every user is signed out.

**Backups** are not automated yet — DEPLOYMENT.md plans a scheduled `pg_dump` to object storage.
Until then, before anything risky:
`docker compose exec -T postgres pg_dump -U revisor revisor | gzip > revisor-$(date +%F).sql.gz`,
and copy the file off the VM.
