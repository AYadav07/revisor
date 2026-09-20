# Revisor — UI Design

Living document. Full frontend design detail — theme, components, pages, forms. See
ARCHITECTURE.md §8 for the frontend's structural/technical decisions (state management,
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
  --background: 0 0% 100%;
  --foreground: 222 47% 11%;
  --primary: 221 83% 53%;          /* main brand/action color */
  --primary-foreground: 0 0% 100%;
  --muted: 210 40% 96%;
  --muted-foreground: 215 16% 47%;
  --border: 214 32% 91%;
  --destructive: 0 84% 60%;        /* delete actions, overdue state */
  --success: 142 71% 45%;          /* learned / on-schedule state */
  --warning: 38 92% 50%;           /* due soon / low ease factor */
  --radius: 0.5rem;
}

:root[data-theme="dark"] {
  --background: 222 47% 11%;
  --foreground: 210 40% 98%;
  --primary: 217 91% 60%;
  --primary-foreground: 222 47% 11%;
  --muted: 217 33% 17%;
  --muted-foreground: 215 20% 65%;
  --border: 217 33% 20%;
  --destructive: 0 72% 55%;
  --success: 142 60% 50%;
  --warning: 38 85% 55%;
}
```
Theme toggle: `data-theme` attribute on `<html>`, persisted in `localStorage`, defaulting
to the OS preference (`prefers-color-scheme`) on first visit.

**Color semantics — state communicates via color across the app:**
- `success` (green) → subtopic learned / on schedule
- `warning` (amber) → due soon / weak ease factor
- `destructive` (red) → overdue / delete actions
- `primary` → main actions (Learn, Review, Save, Sign in)

**Typography:** Inter (Google Fonts, self-hostable later), Tailwind's default type scale
(`text-sm` → `text-2xl`) — no custom sizes invented per-page.

**Spacing:** Tailwind's default 4px-based scale (`p-2`, `gap-4`, `p-6`, …) — no custom
scale.

## 3. Layout / navigation
- **`AppShell`** — persistent layout for all authenticated pages: top nav bar (logo,
  "Dashboard" / "Courses" links, user menu with theme toggle + logout).
- **`AuthLayout`** — minimal centered-card layout for `/login` and `/signup`, no nav.

## 4. Pages

| Route | Purpose | Key components |
|---|---|---|
| `/login`, `/signup` | Auth | `AuthForm`, `AuthLayout` |
| `/courses` | Course list | `CourseCard`, `CreateCourseDialog`, `EmptyState` |
| `/courses/:id` | Topic/subtopic tree for one course | `TopicAccordion`, `SubtopicRow`, `AddTopicForm` |
| `/subtopics/:id/review` | Review-grading flow | `ReviewPrompt`, `QualityGradeButtons`, `RevealButton` |
| `/dashboard` | Due today/week, progress | `DueList`, `ProgressBar`, `StatTile` |
| `/admin/users` | Admin only, route-guarded | `UserTable`, `UserStatusBadge` |

`/courses/:id` fetches the whole tree in one `GET /courses/{id}` call (topics +
subtopics nested — see API.md) and renders it directly into `TopicAccordion` /
`SubtopicRow` — no per-topic or per-subtopic fetch on expand.

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
├── badge.tsx             # status: "Due", "Overdue", "Learned"
├── card.tsx
├── accordion.tsx         # topic tree
├── toast.tsx              # success/error notifications
├── skeleton.tsx            # loading states, pairs with TanStack Query
└── dropdown-menu.tsx       # user menu (theme toggle, logout)
```
Every feature component is built from these — no feature ever styles a raw HTML element
directly. This is the mechanism that keeps the whole app visually consistent from one file.

## 6. Forms
**Decision: React Hook Form + Zod.** One consistent pattern across every form in the app
(signup, login, create/edit course/topic/subtopic, admin panel):
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

Signup form additionally captures `timezone` silently (not a user-facing field) via
`Intl.DateTimeFormat().resolvedOptions().timeZone` and includes it in the submitted
payload — see API.md.

## 7. Open items
- Exact copy/microcopy for empty states, error toasts, confirmation dialogs.
- Accessibility pass (keyboard nav through the review flow, screen-reader labels) — deferred
  to a dedicated pass once the core flow is built, not before.