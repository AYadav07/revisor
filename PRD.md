# Revisor — Product Requirements Doc (v1, v2 in §8)

## 1. Problem
Preparing for interviews (DSA, system design, core CS, company-specific rounds) involves
juggling many topics and subtopics, each needing both an initial *learn* pass and repeated
*revision* passes over time. Today this is tracked ad-hoc (spreadsheets, notes apps) with no
scheduling logic — topics get forgotten or revised too late/too early.

## 2. Target users (v1)
- Primary: the builder (backend engineer prepping for product-company interviews).
- Secondary: a small group of friends also prepping — each user has their own private
  topic list and schedule.
- Designed to support many concurrent users from day one (see ARCHITECTURE.md §5) even
  though the actual v1 userbase is small — the goal is to only ever *add* features later,
  not redesign.

## 3. Goals for v1
- Organize prep material as Courses → Topics → Subtopics.
- Mark subtopics as "learned" on a given date.
- Auto-generate a revision schedule per subtopic using SM-2 spaced repetition, based on
  self-rated recall quality at each revision.
- Dashboard: what's due today/this week, what's overdue, overall progress per course.
- **Email verification at signup** — a new account can't log in until the user clicks
  the verification link emailed to them (see SECURITY.md).
- **Password reset ("forgot password")** via an emailed, single-use, short-lived link.
- A minimal in-app admin view: manage users (see all, disable, delete), read-only view of
  any user's courses/progress.
- A React frontend covering auth (incl. verify/reset screens), course management, the
  learn/review flow, and the dashboard.

## 4. Explicit non-goals for v1
- No AI-graded self-explanations.
- No mock-interview chatbot.
- No social/leaderboard features between users, no peer-to-peer sharing. The only
  cross-user visibility is the admin read-only view, scoped to the ADMIN role.
- No mobile app — responsive web only.
- No admin content editing (admin can't edit another user's courses/topics) or user
  impersonation ("login as") — out of scope unless a real need appears.
- **No SMS or other non-email notifications.** The notification module is designed so an
  SMS channel can be added without rewriting (ARCHITECTURE.md §8), but none is built, and
  users have no phone number field in v1.
- No email change flow (changing the account email after signup) — would need
  re-verification of the new address; deferred.
- No marketing/digest emails (e.g. "you have 5 reviews due today") — only transactional
  auth emails in v1.
- No topic/subtopic drag-and-drop reordering persistence in v1 — `order_index` exists in
  the data model, but no dedicated reorder endpoint yet (see API.md).

## 5. Project name
**Revisor** — locked in.

## 6. V1 milestones
1. Backend skeleton + entities + migrations (Flyway)
2. Auth: signup, login, refresh, logout (see SECURITY.md)
3. Course/Topic/Subtopic CRUD API (with soft delete on Topic and Subtopic)
4. Learn + Review endpoints with SM-2 service (unit tested), review-without-learn gated
5. Dashboard query endpoints (per-user timezone aware)
6. Admin: user list/disable/delete, read-only cross-user view, admin action log
7. React frontend: course tree view, learn/review flow, dashboard, auth screens
8. Swagger/OpenAPI, logging, Actuator health checks
9. Backend: Docker Compose + Caddy deployment, CI/CD via GitHub Actions
10. Frontend: Cloudflare Pages deployment on a custom domain
11. Email verification + password reset: `notification` module (EmailChannel,
    SmtpEmailSender, templates), verification/reset tokens and endpoints, frontend
    verify/reset screens, Mailpit locally, Resend in production with `aydev.in` verified
    as the sender domain (SPF/DKIM/DMARC) — see ARCHITECTURE.md §8, SECURITY.md,
    DEPLOYMENT.md
12. Deploy a demo instance — backend on GCP e2-micro at `api.revisor.aydev.in`, frontend
    on Cloudflare Pages at `revisor.aydev.in`

## 7. Future (v2+, out of scope now)
- AI-graded self-explanation on review
- Mock interview chatbot
- Shared/team courses between friends
- SMS notifications (new `SmsChannel` + `SmsSender`; needs a verified phone number on
  `User`)
- Email change flow with re-verification
- Due-review reminder/digest emails
- Topic/subtopic drag-and-drop reorder persistence
- Bulk "mark as learned" (e.g. while importing an outline) — learning is tied to a date
  and seeds the SM-2 schedule, so it needs its own design rather than riding on import

## 8. V2: bulk outline import & export
Adding a course one topic and one subtopic at a time is slow when the material already
exists as a syllabus, a markdown list or notes. V2 lets the user write (or paste) a
plain-text **outline**, preview it as a tree, and save it in one go.

**Goals**
- **Import a course:** create a new course with all its topics, subtopics and notes from
  one outline.
- **Bulk add to a course:** add topics and subtopics to an existing course from an
  outline. A topic whose title matches an existing one (case-insensitively) is merged
  into it, not duplicated.
- **Conflicts are the user's call:** a subtopic that already exists under that topic is
  left alone when the outline brings no new notes; when its notes differ, the preview
  flags it and the user picks Overwrite or Skip per subtopic (or for all). Overwrite
  replaces the notes only — learning progress and the review schedule are untouched.
- **Notes included:** lines indented under a subtopic become its notes.
- **Export a course as an outline** in the same format (copy or download), so a course
  can be backed up, edited elsewhere and re-imported.
- All-or-nothing: an import or bulk add either saves entirely or not at all.

**Non-goals for v2**
- The outline only adds and updates notes — it never renames, moves or deletes anything.
- No marking as learned from the outline (see §7).
- No other import formats (CSV, JSON upload, other apps' exports).

**Milestones**
13. Docs: outline format, endpoints, merge/conflict rules, pages (this section, API.md,
    ARCHITECTURE.md §9a, Ui design.md)
14. Backend: `POST /courses/import` and `POST /courses/{id}/outline` in the `course`
    module, with a pure `OutlineMerger` for the match/merge/conflict rules
15. Frontend: outline parser/formatter, import and bulk-add pages with live preview and
    conflict choices, export from the course page