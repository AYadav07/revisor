# Revisor — UI Design

Living document. Full frontend design detail — theme, components, pages, forms. See
ARCHITECTURE.md §9 for the frontend's structural/technical decisions (state management,
data fetching, routing, component folder structure); this doc is the visual/UX layer on
top of that.

## 1. Styling stack
**Decision: Tailwind CSS + shadcn/ui.** shadcn/ui is not an installed component library —
components (Button, Dialog, Select, Card, etc.) are copied into `src/components/ui/` and
owned/customized directly, built for Tailwind + React + TypeScript, accessible by default
(built on Radix UI primitives).

**Why this over MUI or plain CSS:** full control over visual identity without fighting a
library's opinions (MUI), and far less hand-built boilerplate for accessibility/responsive
behavior than raw CSS Modules. Also a current, genuinely common industry choice — a fair
interview talking point.

**Centralization mechanism (the actual answer to "how do we manage this in one place"):**
every component references semantic Tailwind classes (`bg-primary`, `text-muted-foreground`,
`border-border`) that resolve to CSS variables defined in one file. Changing the theme is
editing that one file — no component code changes, and it applies identically to light and
dark mode since both are defined as alternate values for the same variable names.

## 2. Theme tokens

```css
/* src/index.css */
:root {
  --background: 220 27% 96%;       /* page canvas — a cool tint, so white panels stand off it */
  --card: 0 0% 100%;               /* panels, sidebar, dialogs */
  --foreground: 222 47% 11%;
  --primary: 221 83% 53%;          /* main brand/action color */
  --primary-foreground: 0 0% 100%;
  --muted: 210 40% 96%;
  --muted-foreground: 215 16% 47%;
  --border: 220 18% 88%;
  --destructive: 0 84% 60%;        /* delete actions, overdue state */
  --success: 142 71% 45%;          /* learned / on-schedule state */
  --warning: 38 92% 50%;           /* due soon / low ease factor */
  --radius: 0.5rem;
}

:root[data-theme="dark"] {
  --background: 224 47% 7%;
  --card: 222 44% 11%;             /* a step lighter than the canvas */
  --foreground: 210 40% 98%;
  --primary: 217 91% 60%;
  --primary-foreground: 222 47% 11%;
  --muted: 217 33% 17%;
  --muted-foreground: 215 20% 65%;
  --border: 217 30% 19%;
  --destructive: 0 72% 55%;
  --success: 142 60% 50%;
  --warning: 38 85% 55%;
}
```
**Color in the structure** (revised again after feedback that the white panels still read as
an unfinished template): color sits in the app's frame and headers, not only in small accents.
- **Sidebar** — deep navy in both themes (`--sidebar*` tokens): light text, the active item a
  solid `primary` pill, the due count an amber (`warning`) badge.
- **Hero headers** — the dashboard and course pages open on a blue → violet gradient band
  (`--hero-from` → `--hero-to`, deeper stops than `primary`/`--brand-2` so white text reads in
  both themes) with the `<h1>`, a line of context and the page's main actions in white.
- **Stat tiles** — washed and bordered in their state color, with a solid state-colored icon chip.
- **Course cards** — a gradient cover strip with the course badge sitting on its edge.
- **Topic panels** — a `primary` left edge and a tinted header row while open.
- **Sign-in / sign-up** — split screen on wide displays: a gradient brand panel (a one-line
  pitch and three plain facts about the app) beside the form.
Everything else — lists, forms, the due list, charts — stays on white panels, so the colored
frame doesn't compete with the content.

**Depth:** content is grouped by surface, not by lines — panels (`card`) sit on a tinted
canvas (`background`), with a light border and a small shadow. No gradients, no decorative
shadows; the canvas/panel contrast does the work. (Revised from an all-white first version,
where page, cards and nav were indistinguishable.)

Theme toggle: `data-theme` attribute on `<html>`, persisted in `localStorage`, defaulting
to the OS preference (`prefers-color-scheme`) on first visit.

**Color semantics — state communicates via color across the app:**
- `success` (green) → subtopic learned / on schedule / email verified
- `warning` (amber) → due soon / weak ease factor / email unverified (admin table)
- `destructive` (red) → overdue / delete actions / invalid or expired link
- `primary` → main actions (Review, Save, Sign in)

Every subtopic row starts with a small **state marker** — hollow (not started), `success`
(learned, next review in the future), `warning` (due today), `destructive` (overdue) — and
spells the state out in a badge, so color is never the only signal. The course page's
progress panel lists the same four states with the same markers, doubling as the legend.
"Mark as learned" is an outline button: the loud, filled `primary` button on a row is
reserved for "Review", so what's due is what catches the eye.

**Typography:** Inter (Google Fonts, self-hostable later), Tailwind's default type scale
(`text-sm` → `text-2xl`) — no custom sizes invented per-page.

**Spacing:** Tailwind's default 4px-based scale (`p-2`, `gap-4`, `p-6`, …) — no custom
scale.

## 3. Layout / navigation
- **`AppShell`** — persistent layout for all authenticated pages, **full width** (no max-width
  container; pages use responsive grids that add columns on wider screens rather than
  stretching text):
  - **Large screens (`lg`+):** a fixed left **`Sidebar`** (`w-64`, `bg-sidebar`, navy) with the brand,
    main navigation (Dashboard, Courses, Admin for admins), **"Your courses"** — every course
    with a learned/total count and a thin progress bar, linking to it, the current one
    highlighted — and the user menu (theme toggle + sign out) pinned at the bottom.
  - **Small screens:** a top bar with a menu button that slides the same sidebar in as a
    `Sheet`; following a link closes it.
- **`AuthLayout`** — minimal centered-card layout for all public auth pages (`/login`,
  `/signup`, `/check-email`, `/verify-email`, `/forgot-password`, `/reset-password`), no
  nav, brand mark above the card. The new email pages reuse the same split-screen brand
  panel as sign-in/sign-up on wide displays, so every public page looks like one family.

## 4. Pages

| Route | Purpose | Key components |
|---|---|---|
| `/login`, `/signup` | Auth | `AuthForm`, `AuthLayout` |
| `/check-email` | "Check your inbox" after signup or unverified login, with resend | `CheckEmailCard`, `ResendButton` |
| `/verify-email?token=` | Redeem verification link | `TokenResultCard` |
| `/forgot-password` | Request a reset link | `ForgotPasswordForm` |
| `/reset-password?token=` | Set a new password | `ResetPasswordForm`, `TokenResultCard` |
| `/courses` | Course list | `CourseCard`, `CreateCourseDialog`, `EmptyState` |
| `/courses/:id` | Topic/subtopic tree for one course | `TopicAccordion`, `SubtopicRow`, `AddTopicForm` |
| `/subtopics/:id/review` | Review-grading flow | `ReviewPrompt`, `QualityGradeButtons`, `RevealButton` |
| `/dashboard` | Due today/week, progress | `DueList`, `ProgressBar`, `StatTile` |
| `/admin/users` | Admin only, route-guarded | `UserTable`, `UserStatusBadge` |

**Course badges:** every course carries a `CourseAvatar` — its initials on the brand tint —
in the sidebar, course cards, the course page header and the due list's course groups.
**One tint for all courses, deliberately:** a distinct color per course was checked with the
data-viz palette validator and fails — past three hues, some pairs can't be told apart even
with full color vision — and the candidate hues sit next to the reserved state colors. The
initials and the name carry identity.

**Page layouts:**
- `/dashboard` — header greets the user by first name with how many reviews are waiting, and
  a "Start review" action. Stat tiles in a row (each with an icon in its state color: due today
  `warning`, overdue `destructive` when non-zero, learned `success`); below, the due list
  (two-thirds, rows grouped under course badges) beside **"Coming up"** — a seven-day review
  forecast (one bar per day, today including overdue, from `GET /dashboard/due?range=week`;
  single series in `primary`, hover/focus tooltips, per-day screen-reader labels) — and
  per-course progress.
- Sidebar: the Dashboard link carries a count of everything reviewable now (due today +
  overdue).
- `/courses` — a grid of course cards, 1 → 2 → 3 → 4 columns as the screen widens, each card
  showing its learned/total and a progress bar.
- `/courses/:id` — on `xl` screens, topics (each topic its own panel) in two-thirds of the
  width and a side panel with the course's progress, the per-state counts and "Add a topic";
  on smaller screens the side panel follows the topics. On phones a subtopic's actions wrap
  below its text.
- `/subtopics/:id/review` — deliberately a centered `max-w-3xl` column: reviewing is reading,
  and long lines are harder to recall from. A session progress bar sits above a flashcard: where
  the subtopic is from and its title, centered; on reveal, the notes below a rule and the grade
  buttons, each with a stripe on SM-2's pass/fail line (0–1 `destructive`, 2 `warning` — these
  reset the schedule — 3–5 `success`). **Keyboard:** Space reveals, 0–5 grades (ignored while
  typing or with a modifier held), with the keys hinted on screen.

`/courses/:id` fetches the whole tree in one `GET /courses/{id}` call (topics +
subtopics nested — see API.md) and renders it directly into `TopicAccordion` /
`SubtopicRow` — no per-topic or per-subtopic fetch on expand.

### Email verification & password reset flows
- **Signup → `/check-email`**: after `201`, navigate to `/check-email` showing the address
  it was sent to and a "Resend email" button (disabled with a 60s countdown after each
  click; a `429` shows a "try again later" toast).
- **Login with unverified email**: a `403 email-not-verified` response routes to
  `/check-email` with the email prefilled — not a generic error toast.
- **`/verify-email`**: on mount, read `token` from the URL, `history.replaceState` it away,
  POST it once (guard against React StrictMode double-invoke), then show success ("Email
  verified — sign in") or failure ("This link is invalid or expired" + resend option).
- **`/login` → "Forgot password?" link → `/forgot-password`**: one email field; on submit
  *always* show the same "If an account exists for that email, we've sent a link"
  message — never "no such user" (mirrors the API's 202-always behavior).
- **`/reset-password`**: same token read-and-strip pattern; form with new password +
  confirm. On `204`, toast "Password updated — sign in" and go to `/login`. On
  `invalid-token`, show `TokenResultCard` with a link back to `/forgot-password`.
- **Admin `UserTable`**: an "Unverified" `warning` badge next to users whose
  `emailVerified` is false.

### Review-grading flow (the core interactive screen)
**Decision: queues multiple due subtopics in one sitting** (confirmed) — entering
`/subtopics/:id/review` starts a review session over all subtopics currently due
(sourced from `GET /dashboard/due`), not just the one named in the URL.
1. Show the current subtopic's title + notes, quality-grading controls hidden.
2. User clicks "Reveal" (simulates active recall before seeing the answer/notes).
3. Five `QualityGradeButtons` appear, labeled not just numbered — "Blackout" (0), "Wrong"
   (1), "Hard" (2), "Hesitant" (3), "Good" (4), "Perfect" (5) — reducing the grading
   ambiguity flagged as an inherent SM-2 tradeoff in ARCHITECTURE.md §3.
4. On submit: `POST /subtopics/{id}/review`, toast confirmation showing the new
   `nextReviewDate`, then automatically advance to the next due subtopic in the queue.
5. When the queue is empty, show a completion state and return to `/dashboard`.

### Dashboard
- `StatTile` row: due today, overdue count, total subtopics learned.
- `DueList`: subtopics due today/this week, grouped by course, each row showing a
  `warning`/`destructive` `Badge` based on how overdue it is.
- `ProgressBar` per course: subtopics learned / total.

## 5. Component inventory (shadcn/ui primitives, customized to the theme above)
```
src/components/ui/
├── button.tsx        # variants: default (primary), destructive, outline, ghost
├── input.tsx
├── textarea.tsx        # subtopic notes
├── dialog.tsx           # create/edit course, topic, subtopic
├── select.tsx
├── badge.tsx             # status: "Due", "Overdue", "Learned", "Unverified"
├── card.tsx
├── accordion.tsx         # topic tree
├── toast.tsx              # success/error notifications
├── skeleton.tsx            # loading states, pairs with TanStack Query
├── dropdown-menu.tsx       # user menu (theme toggle, logout)
├── sheet.tsx               # the sidebar on small screens (Radix Dialog, slides in)
└── progress.tsx            # course progress bars
```
Every feature component is built from these — no feature ever styles a raw HTML element
directly. This is the mechanism that keeps the whole app visually consistent from one file.

## 6. Forms
**Decision: React Hook Form + Zod.** One consistent pattern across every form in the app
(signup, login, forgot/reset password, create/edit course/topic/subtopic, admin panel):
```tsx
const courseSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(1000).optional(),
});

const form = useForm({ resolver: zodResolver(courseSchema) });
// shadcn <Form> components wired to react-hook-form
// onSubmit -> TanStack Query mutation -> toast on success/error
```
Zod schemas mirror the backend's Bean Validation rules where they overlap (e.g. title
`@NotBlank` + `@Size` on the DTO ↔ `z.string().min(1).max(200)`), so client and server
validation stay in sync in intent even though they're separately maintained.

Reset-password schema: `newPassword` `min(8)` (matches SECURITY.md) plus a
`confirmPassword` field checked with `.refine()` client-side only — the API receives just
`{ token, newPassword }`.

Signup form additionally captures `timezone` silently (not a user-facing field) via
`Intl.DateTimeFormat().resolvedOptions().timeZone` and includes it in the submitted
payload — see API.md.

**Email templates** (backend, `resources/templates/email/`) follow the same brand: primary
color for the single call-to-action button, plain-text fallback for every HTML email, the
link also printed as text below the button, and expiry stated ("This link expires in 30
minutes"). Sent from `Revisor <noreply@aydev.in>`.

## 7. Open items
- Exact copy/microcopy for empty states, error toasts, confirmation dialogs, and the two
  email templates.
- Accessibility pass (keyboard nav through the review flow, screen-reader labels) — deferred
  to a dedicated pass once the core flow is built, not before.