import { z } from 'zod'

// The production CSP forbids eval (script-src 'self'). Zod would otherwise probe for it with
// `new Function`: harmless (it falls back), but each probe is a CSP violation report.
//
// Zod reads this when each schema is constructed, and schemas are built at module load — so this
// file must be imported before anything that defines one (first thing in main.tsx).
z.config({ jitless: true })
