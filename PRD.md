# Revisor — Product Requirements Doc (v1)

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