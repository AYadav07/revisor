# Prep Tracker — Product Requirements Doc (v1)

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
- A minimal in-app admin view: manage users (see all, disable, delete), read-only view of
  any user's courses/progress.

## 4. Explicit non-goals for v1
- No AI-graded self-explanations.
- No mock-interview chatbot.
- No social/leaderboard features between users, no peer-to-peer sharing. The only
  cross-user visibility is the admin read-only view, scoped to the ADMIN role.
- No mobile app — responsive web only.
- No admin content editing (admin can't edit another user's courses/topics) or user
  impersonation ("login as") — out of scope unless a real need appears.

## 5. Project name
Working title: **Revisor** — not fully locked in, revisit if a better name comes up.

## 6. V1 milestones
1. Backend skeleton + entities + migrations (Flyway)
2. Auth: signup, login, refresh, logout (see SECURITY.md)
3. Course/Topic/Subtopic CRUD API (with soft delete on Subtopic)
4. Learn + Review endpoints with SM-2 service (unit tested), review-without-learn gated
5. Dashboard query endpoints (per-user timezone aware)
6. Admin: user list/disable/delete, read-only cross-user view, admin action log
7. React frontend (design deferred — see ARCHITECTURE.md §8)
8. Swagger/OpenAPI, logging, Actuator health checks
9. Docker Compose + Caddy deployment, CI/CD via GitHub Actions
10. Deploy a demo instance (hosting platform: decision deferred)

## 7. Future (v2+, out of scope now)
- AI-graded self-explanation on review
- Mock interview chatbot
- Shared/team courses between friends
