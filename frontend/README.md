# Revisor — frontend

React + TypeScript + Vite, per ARCHITECTURE.md §8 / UI_DESIGN.md. See those docs and the
repo root CLAUDE.md before adding anything here.

```
npm install
npm run dev      # Vite dev server, http://localhost:5173
npm run build    # tsc -b && vite build
npm run lint      # oxlint
```

Backend must be running (see ../backend) — the app calls it directly, no API proxy.
