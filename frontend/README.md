# Revisor — frontend

React + TypeScript + Vite, per ARCHITECTURE.md §8 / UI_DESIGN.md. See those docs and the
repo root CLAUDE.md before adding anything here.

```
npm install
npm run dev         # Vite dev server, http://localhost:5173
npm run build       # tsc -b && vite build
npm run lint        # oxlint
npm test            # vitest run (once)
npm run test:watch  # vitest, watch mode
```

The backend must be running (see ../backend) — the app calls it directly, no proxy. Its origin
comes from `VITE_API_URL` (see `.env.example`); unset means `http://localhost:8080`.

For the full local setup (Postgres + backend + frontend) and a manual test checklist, see the
root [README.md](../README.md). Quickest alternative: start the backend on the in-memory `local` profile (no database or key files
needed): `cd ../backend && SPRING_PROFILES_ACTIVE=local ./gradlew bootRun`, then `npm run dev`.
The `local` profile allows the `http://localhost:5173` origin and issues non-`Secure` cookies.

## Layout

- `src/api/` — the only code that talks HTTP. `client.ts` is the fetch wrapper (cookies, RFC 7807
  errors, single-flight token refresh on 401); `*Api.ts` is one file per backend module; `types.ts`
  mirrors the API contract in API.md.
- `src/lib/` — app-wide setup that isn't UI (the TanStack Query client).
- `src/components/ui/` — shadcn primitives (see UI_DESIGN.md §5).
- `scripts/` — build-time code, not shipped: the Cloudflare Pages plugin (below).

## Deploying to Cloudflare Pages

Pages builds and deploys on every push to `main` (DEPLOYMENT.md). The build itself guards the
config: on Cloudflare (`CF_PAGES=1`) it fails unless `VITE_API_URL` is set and `https://`, and it
writes `dist/_headers` — the CSP and other security headers (SECURITY.md) with `connect-src` taken
from `VITE_API_URL`. See `scripts/cloudflarePages.ts`.

One-time setup, once the domain is chosen and the backend is live at `https://api.<domain>`:

1. Cloudflare dashboard → Workers & Pages → Create → Pages → **Connect to Git** → this repository.
2. Build settings:

   | Setting | Value |
   |---|---|
   | Production branch | `main` |
   | Framework preset | None (or Vite) |
   | Root directory | `frontend` |
   | Build command | `npm run build` |
   | Build output directory | `dist` |

   Node comes from `frontend/.nvmrc`.
3. Environment variables → **Production**: `VITE_API_URL` = `https://api.<domain>`. Set it for
   **Preview** too (the same value is fine), or preview builds fail the guard.
4. Custom domains → add **`app.<domain>`** (a CNAME to the Pages project; automatic if the domain's
   DNS is on Cloudflare). The backend's `.env` must list exactly this origin in
   `APP_CORS_ALLOWED_ORIGINS` (`deploy/README.md`).
5. Push to `main`, open `https://app.<domain>` and sign up.

Preview deployments (`*.pages.dev`) can't sign in — they're not on the custom domain, so the
`SameSite=Strict` auth cookies are never sent and the API's CORS allowlist excludes them. They're
for visual review only.

To reproduce a production build locally: `CF_PAGES=1 VITE_API_URL=https://api.example.dev npm run
build`, then inspect `dist/_headers`.
