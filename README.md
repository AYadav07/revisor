# Revisor

A personal interview-prep app: organise material as Courses → Topics → Subtopics, mark subtopics
learned, then revise them on an SM-2 spaced-repetition schedule. React frontend, Spring Boot
backend, PostgreSQL.

Design docs: [PRD.md](PRD.md) (scope), [ARCHITECTURE.md](ARCHITECTURE.md), [API.md](API.md),
[SECURITY.md](SECURITY.md), [DEPLOYMENT.md](DEPLOYMENT.md), [Ui design.md](Ui%20design.md).
Working conventions for contributors (and Claude Code) are in [CLAUDE.md](CLAUDE.md).

## Run it locally

Three processes, each in its own terminal: **PostgreSQL** (Docker), the **backend** (port 8080)
and the **frontend** (port 5173).

### Prerequisites
- Docker with the Compose plugin
- JDK 25 (Gradle's toolchain setting can download it for you if it's missing)
- Node.js and npm

### 1. PostgreSQL

The database password lives in `backend/.env` (gitignored — create it once):

```bash
cd backend
echo 'DB_PASSWORD=choose-a-local-password' > .env   # first time only
docker compose up -d postgres
docker compose ps                                      # postgres should be "Up", port 5432
```

Data persists in the `pgdata` volume across restarts. `docker compose down` stops it;
`docker compose down -v` also **wipes the data**.

### 2. Backend — http://localhost:8080

The default `dev` profile connects to that Postgres on `localhost:5432` and signs tokens with an
RSA key pair read from `backend/secrets/` (gitignored). Create the pair once:

```bash
cd backend
scripts/generate-jwt-keys.sh      # first time only; refuses to overwrite an existing pair
```

The backend needs the **same** database password as the container, read from `.env`:

```bash
cd backend
SPRING_DATASOURCE_PASSWORD="$(grep '^DB_PASSWORD=' .env | cut -d= -f2-)" ./gradlew bootRun
```

Ready when the log says `Started RevisorApplication`. Flyway creates/migrates the schema on
startup. Check it:

```bash
curl localhost:8080/actuator/health          # {"status":"UP",...}
```

- API docs (Swagger UI): http://localhost:8080/swagger-ui.html — raw spec at `/v3/api-docs`.
  To call protected endpoints from Swagger, sign in through the app first (same browser) or call
  `POST /api/v1/auth/login` from Swagger itself; the auth cookies are then sent automatically.
- No Docker? `SPRING_PROFILES_ACTIVE=local ./gradlew bootRun` runs on an in-memory H2 database
  instead — nothing to install, but all data is lost when it stops.

### 3. Frontend — http://localhost:5173

```bash
cd frontend
npm install        # first time, or after dependencies change
npm run dev
```

It calls the backend at `http://localhost:8080` (override with `VITE_API_URL`, see
`frontend/.env.example`). Open **http://localhost:5173** — use `localhost`, not `127.0.0.1`: the
backend only allows the `http://localhost:5173` origin, and the auth cookies are tied to the host
name.

## Manual test checklist

With all three running, walk through the app at http://localhost:5173:

1. **Sign up** at `/signup`, you land on the dashboard. **Sign out** from the user menu (top
   right), then **sign in** again at `/login`. A wrong password shows an error; after 5 attempts in
   15 minutes for one email you get a "too many attempts" message.
2. **Theme:** switch light/dark/system from the user menu.
3. **Courses:** create a course, edit its title/description, open it.
4. **Topics & subtopics:** add a topic, rename it, add subtopics (with notes), edit and delete a
   subtopic, delete a topic (its subtopics go with it).
5. **Learn:** click **Mark as learned** on a few subtopics — each shows a *Learned* badge and a
   next-review date (tomorrow). The course page and dashboard progress update.
6. **Dashboard:** stat tiles (due today / overdue / learned), the *Due for review* list with its
   *Today* / *This week* toggle, and per-course progress bars.
7. **Review:** nothing is due until tomorrow. To test now, make your learned subtopics due
   yesterday (local database only):

   ```bash
   cd backend
   docker compose exec postgres psql -U revisor -d revisor \
     -c "UPDATE schedule_entry SET next_review_date = CURRENT_DATE - 1;"
   ```

   Refresh the dashboard: items show as *1 day overdue*. Click **Start review** — for each
   subtopic, **Reveal** the notes, pick a grade (Blackout … Perfect), and a toast shows the next
   review date before it advances. The last one ends on *Session complete*. Grades below
   *Hesitant* schedule it for tomorrow again; higher grades push it further out.
8. **Access control:** open a course URL with a made-up id (`/courses/999999`) → *Course not
   found*. Sign up a second user in a private window — they can't see the first user's courses.
9. **Admin** (needs an ADMIN account, see below): the *Admin* link appears in the nav. Search
   users, open a user's courses (read-only), disable a user (they're signed out everywhere), and
   delete a disabled user. You can't disable or delete yourself.
10. **Errors:** stop the backend while the app is open, then navigate — pages show a *Couldn't
    load… / Try again* message instead of breaking. Start it again and retry.

### Getting an admin account

Admin is never granted by the app itself (SECURITY.md). Sign up the account normally, then follow
the steps in
[`backend/src/main/resources/db/migration/admin-bootstrap.sql.template`](backend/src/main/resources/db/migration/admin-bootstrap.sql.template):
copy it as the next Flyway migration (e.g. `V3__promote_initial_admin.sql` in
`db/migration/postgresql/`), set the email, restart the backend, then sign out and back in so the
new role is in your token.

## Automated tests

```bash
cd backend && ./gradlew test                            # in-memory H2; never touches your dev database
cd backend && ./gradlew test -PincludePostgresTests     # also the Testcontainers suites (needs Docker)
cd frontend && npm test && npm run lint
```

## Troubleshooting

- **Backend fails with `password authentication failed for user "revisor"`** — the backend was
  started without `SPRING_DATASOURCE_PASSWORD`, or `.env` changed after the volume was created
  (Postgres keeps the password from its first start; `docker compose down -v` resets it, wiping
  data).
- **Backend fails with `Cannot read key file secrets/jwt_private.pem`** — run
  `scripts/generate-jwt-keys.sh` in `backend/`, and start the backend from `backend/` (the default
  key paths are relative to it). Elsewhere, set `JWT_PRIVATE_KEY_PATH` / `JWT_PUBLIC_KEY_PATH`.
- **`Connection to localhost:5432 refused`** — Postgres isn't running: `docker compose up -d
  postgres` in `backend/`.
- **Signed in, but every request is 401 / you're bounced to `/login`** — you're on
  `127.0.0.1:5173` instead of `localhost:5173`, or the JWT keys were regenerated (sign in again).
- **Port already in use** — something else is on 8080/5173/5432; stop it or change the port.
