# Background Jobs & Realtime

Two separate concerns that often share infrastructure:

- **Jobs** — work the server does, decoupled from a request. Push.
- **Realtime** — pushing state changes out to connected clients. Subscribe.

## Background jobs

### When to move work off the request path

If any of these are true, the work belongs in a job, not in the handler:

- Takes longer than the user is willing to wait (≈ 200ms is a reasonable cutoff).
- Calls a third party that may be slow or fail.
- Sends email / SMS / push.
- Generates files, thumbnails, reports, exports.
- Fans out to many recipients.
- Recomputes derived state.

### Job requirements (non-negotiable)

- **Idempotent.** The same job running twice produces the same end state, not duplicate side effects. Use a unique key (e.g., `idempotency_key`, `(entity_id, operation)`) and check before acting.
- **Retryable with backoff and jitter.** Exponential backoff (1s, 2s, 4s, ...) with random jitter so retries don't pile up.
- **Bounded retries.** After N attempts, send to a dead-letter destination. Alert on dead-letter depth.
- **Observable.** Each job emits a structured log on start, success, and failure, with a job-id and the entity it's operating on.
- **Time-bounded.** Every job has a max run time. A worker that hangs forever is worse than one that fails.

### Scheduling

- **Cron-style schedules** for periodic work (nightly cleanup, hourly aggregations). Document each one — what it does, what happens if it skips a run.
- **One-shot delayed jobs** for things like "send reminder in 24h." A scheduler table or a delayed-queue feature.
- **Don't schedule work in the application's event loop** (no `setTimeout` / `setInterval` for hours-long delays). It dies with the process.

### Choosing infrastructure

In rough order of complexity:

1. **Database-backed queue** — a `jobs` table with `status`, `run_at`, `attempts`, polled with `FOR UPDATE SKIP LOCKED`. Plus a periodic scheduler (`pg_cron` or platform cron). Operationally trivial; performant up to thousands of jobs/sec on a healthy Postgres.
2. **Hosted broker** (SQS, Cloud Tasks, etc.) — when you've outgrown the database queue or need durable cross-region delivery.
3. **Self-hosted broker** (RabbitMQ, Kafka, Redis Streams) — only when neither of the above fits. You now operate two stateful systems.

Default to (1). Most apps never need to leave it.

### Concurrency control per job type

Different jobs need different parallelism:

- **Per-user serialization** — a user's jobs run one at a time so a long export doesn't block a quick action. Lock on `user_id`.
- **Global rate limit** — outbound calls to a 3rd-party API capped at N/sec across all workers.
- **Resource limit** — only K thumbnails generating at once because each takes a CPU.

Express these explicitly per queue/job type, not as a single global "max workers."

## Realtime

### Realtime is not "the same thing as polling, just faster"

It's a **subscription model**: clients say "I care about these things" and the server pushes when those things change. The hard parts are:

- Authorization on the subscription (a client can't subscribe to data it can't read).
- Fan-out: one change → N notified clients. Cost grows with subscribers.
- Reconnection: clients disconnect; they need to catch up on what they missed.

### Transport choices

- **Server-Sent Events (SSE)** — simplest, HTTP-native, one-way (server → client). Good for activity feeds, live status.
- **WebSockets** — bidirectional, more code, more state. Good for chat, collaborative editing, anything where the client also pushes.
- **Database-driven realtime** (Postgres `LISTEN/NOTIFY` or replication-stream-based platforms) — the source of truth emits the event; clients subscribe by table/row predicate. Powerful, but the auth model has to follow the data.
- **Polling** — sometimes the right answer. If "every 30s" is acceptable, polling is simpler than realtime infrastructure and degrades gracefully.

### Authorization on subscriptions

A subscription is a long-lived, server-pushed read. Apply the **same** authorization rules as a read API call — preferably enforced at the data layer so a forgotten check doesn't leak rows. Re-check authorization on every event before sending; tokens may have expired since the connection opened.

### Patterns

- **Channel per resource** — clients subscribe to `order:ord_abc123` and only receive events for that order.
- **Channel per user** — clients subscribe to `user:usr_x` and the server fans out events about anything they're allowed to see.
- **Topic + filter** — clients subscribe to `orders` with a server-side filter expressing what they're allowed to see. Most flexible, hardest to get right.

### Catch-up on reconnect

Clients drop. When they reconnect, they need to know what they missed:

- **Sequence numbers** — every event has a monotonically increasing ID; client sends "last seen N", server replays from N+1.
- **Resume tokens / cursors** — server-provided opaque token; client sends it back on reconnect.
- **Idempotency** — if catch-up replays events the client already saw, it must be safe.

Without one of these, your realtime layer is "best-effort eventually-consistent push" — fine for some uses, wrong for others. Decide explicitly.

### Costs

Realtime costs scale with **connected clients × event rate**. A million idle WebSockets is cheap; a million WebSockets each receiving 10 events/sec is not. Estimate this before committing to a realtime feature.
