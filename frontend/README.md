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
