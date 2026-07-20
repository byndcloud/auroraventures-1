---
name: backend-architect
description: Design and implement production-grade backends with strong defaults for data modeling, API contracts, auth, observability, and scalability. Use this skill whenever the user asks to build, design, scaffold, or review a backend, an API, a database schema, an auth flow, background jobs, file storage, or realtime features. Trigger on casual phrasings like "let's build the backend", "design the API for X", "model this in the database", "how should I store users", "set up auth", "make this scale", or any server-side feature work.
---

# Backend Architect

Use this skill to plan and ship backends that survive production: clear data models, stable API contracts, safe auth, observable behavior, and a path to scale that doesn't require a rewrite.

The skill is **stack-agnostic by design**. It encodes principles that hold whether the runtime is a containerized service, a serverless function, or a Postgres-centric monolith. Map them to whatever the project actually uses.

**On dependencies**: feature work needs feature dependencies — adding `resend` for an email feature, `stripe` for payments, an SDK for a service the user asked to integrate is normal and expected. Just do it. What the skill *does* push back on is unilaterally swapping **architectural pieces** — ORM, validation library, auth library, web framework, error-handling pattern — when the codebase already has one. Those ripple through every file; new feature SDKs don't.

## When to invoke

- "Build / design / scaffold a backend (or feature on the backend)"
- "Design the schema / data model / migrations"
- "Design the API for X" / "what endpoints do we need"
- "Add auth / login / sessions / permissions / RLS"
- "Add realtime / websockets / live updates"
- "Add file uploads / storage / signed URLs"
- "Add a cron job / background worker / scheduled task"
- "Make this scale" / "this is slow under load" / "add caching / rate limits"
- "Review the backend design" / "is this safe / scalable"

## Flow

```
1. Clarify  ──▶  2. Model data  ──▶  3. Define API contracts  ──▶  4. Auth & access
                       │                       │                          │
                       ▼                       ▼                          ▼
              5. Cross-cutting (observability, errors, jobs, realtime, storage)
                                              │
                                              ▼
                            6. Implement  ──▶  7. Validate (loadable, observable, reversible)
```

Each phase has a corresponding reference file. **Read only the references relevant to the current request** — don't pull all of them into context unless the task is greenfield.

## Phase 1 — Clarify

Before designing anything, get answers (or make explicit assumptions) for:

- **Who calls this?** End-user app, internal service, third party, AI agent? Trust level differs.
- **What are the entities?** Nouns in the domain. Their cardinality and lifecycle.
- **What's the read/write shape?** Read-heavy? Write-heavy? Bursty? Realtime?
- **What's the consistency requirement?** Strong, read-your-writes, eventual?
- **What's the auth model?** Anonymous, user-scoped, role-scoped, tenant-scoped?
- **What's the SLA?** P95 target, uptime, max acceptable data loss.

If the user hasn't said and it materially changes the design, **ask once, concisely**. Don't ask a 10-question survey — ask the 1–2 questions that actually fork the design.

## Phase 2 — Model data

Read `references/data-modeling.md`.

Default posture: **relational, normalized, schema-first**. Denormalize only when a measured read pattern justifies it. Every table gets a primary key, created/updated timestamps, and a deletion strategy (hard, soft, or none — pick one explicitly).

Output of this phase: a list of tables with columns, types, nullability, and the relationships between them. Migrations come from this — never the reverse.

## Phase 3 — Define API contracts

Read `references/api-design.md`.

Design the contract before the implementation: resource names, request/response shapes, error shapes, pagination, idempotency. The contract is the product surface; implementation is replaceable, the contract is not.

Output: a list of endpoints (or RPC methods) with request/response schemas and error cases.

## Phase 4 — Auth & access control

Read `references/auth-security.md`.

Decide separately:
1. **Authentication** — how do we know who is calling?
2. **Authorization** — what is this caller allowed to do?

Push authorization **as close to the data as possible**. In a Postgres world that means row-level policies; in a service world it means a single enforcement point the handlers go through. Never scatter ad-hoc permission checks across handlers.

## Phase 5 — Cross-cutting concerns

Pull in only what the feature needs:

- `references/observability.md` — structured logs, metrics, traces, error taxonomy
- `references/scalability.md` — caching, indexing, rate limits, queues, backpressure
- `references/jobs-and-realtime.md` — background jobs, scheduled tasks, pub/sub, fan-out
- `references/storage.md` — file uploads, signed URLs, large objects

## Phase 6 — Implement

Match the existing project's conventions. Don't introduce a new ORM, a new validation library, or a new error-handling pattern unless the user asked for it. If the codebase has an existing pattern for handlers, migrations, or auth — extend it; don't fork it.

This project already has its backend layout established (Supabase: `supabase/migrations/` for schema, `supabase/functions/` for Edge Functions, `src/integrations/supabase/` for client). Extend that structure — do not scaffold a parallel one.

## Phase 7 — Validate (structured emit)

Before reporting the task done, emit the following report verbatim as part of the final response, filling in status and notes for each criterion. This is the **definition of done** for any backend task — do not skip it, even for small changes.

Status values:
- `pass` — criterion met.
- `fail` — criterion not met. Fix it, or convert to `deferred` with explicit reason before shipping.
- `deferred` — intentionally postponed; include a reason and a follow-up owner.
- `n/a` — criterion does not apply to this change; include a one-line reason.

Output template:

~~~markdown
### Backend validation report

| # | Criterion | Status | Note |
|---|-----------|--------|------|
| 1 | Migrations are reversible (or explicitly one-way with a reason) |   |   |
| 2 | Hot-path queries have an index matching their WHERE / ORDER BY / JOIN |   |   |
| 3 | Errors return a typed, machine-readable shape the client can branch on |   |   |
| 4 | Auth enforced at the data layer for any user-scoped resource |   |   |
| 5 | At least one structured log line per request with outcome and request_id |   |   |
| 6 | Secrets read from env / secret store; nothing hard-coded or committed |   |   |

**Deferred items**: <list with reason + follow-up owner, or "none">
**Risks introduced**: <one line, or "none">
**Follow-ups for the user**: <bullets, or "none">
~~~

A `fail` row that ships without being converted to `deferred` is a defect. Treat the report as a gate, not a courtesy. If the task touched multiple surfaces (e.g. schema + API + auth), every applicable row should reflect that scope — don't mark `n/a` to dodge work.

## Anti-patterns to refuse

- Storing passwords in plaintext or with reversible encryption.
- Trusting client-supplied user IDs / role claims without server-side verification.
- Designing endpoints around UI screens instead of resources.
- Adding a cache before measuring the slow query.
- Background jobs with no retry policy and no dead-letter destination.
- Migrations that mutate data and schema in the same step without a backfill plan.
- "We'll add observability later."
