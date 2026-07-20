# Observability

If you can't see it, you can't fix it. Build observability in from the first commit, not after the first incident.

Three pillars, in order of how often you'll reach for them:

1. **Structured logs** — what happened on this request.
2. **Metrics** — how the system behaves in aggregate.
3. **Traces** — where time went on a single request across services.

## Structured logs

- **One log per request, minimum**, written at the end with the outcome. More for important state transitions inside the request.
- **JSON, not freeform text.** A log line is a record, not a sentence. Every line has the same skeleton:

```json
{
  "ts": "2026-05-05T14:32:00.123Z",
  "level": "info",
  "service": "orders-api",
  "request_id": "req_a1b2c3",
  "user_id": "usr_...",
  "tenant_id": "ten_...",
  "route": "POST /v1/orders",
  "status": 201,
  "duration_ms": 84,
  "msg": "order_created",
  "order_id": "ord_..."
}
```

- **`request_id`** is propagated from the edge through every internal call and returned in the response. This is the single most useful field you'll log.
- **Levels mean something.** `error` = a human should look. `warn` = degraded but handled. `info` = normal events. `debug` = off in prod.
- **Don't log secrets, tokens, passwords, or full PII.** Redact at the logger level so a careless caller can't leak.
- Logs are append-only. If you find yourself parsing log text to compute a metric, emit a metric instead.

## Metrics

Four golden signals per service:

- **Latency** — request duration histogram (p50, p95, p99). Distributions, not averages.
- **Traffic** — requests per second, broken down by route.
- **Errors** — error rate per route, broken down by status class.
- **Saturation** — how full the system is (CPU, memory, DB connections, queue depth).

For databases: connection pool usage, query duration p95/p99, replication lag if applicable.

For queues: depth, oldest message age, retry/dead-letter counts.

Cardinality discipline: a label with unbounded values (raw URL with IDs, user IDs, request IDs) will blow up the metrics backend. Bucket high-cardinality fields out — `route` is `/orders/:id`, never `/orders/12345`.

## Traces

Distributed tracing matters once a single request crosses 2+ services or 2+ async hops. Below that, structured logs with a shared `request_id` are usually enough.

When you do trace:
- One trace per request. Spans for outbound calls, DB queries, queue publishes.
- Sample intelligently — 100% of errors, a small fraction of successes.
- Propagate trace context (`traceparent`) across every boundary, including queues.

## Health checks

- **Liveness** — is the process alive? Cheap, no dependencies. Used by the orchestrator to restart.
- **Readiness** — is the process ready to take traffic? Checks dependencies (DB connectable, migrations applied). Used by the load balancer to route.

Don't conflate them. A failing dependency should remove the instance from the LB pool, not kill it.

## Error taxonomy

Bucket every error into one of three categories at the source:

- **User error (`4xx`)** — log at `info` or `warn`. Don't page anyone. Counted but not alerted on individually.
- **Transient error** — retry-able (timeouts, deadlocks, transient network). Log at `warn`. Alert on rate, not on individual occurrences.
- **System error (`5xx`)** — your bug or your dependency's. Log at `error` with full context. Alert.

Misclassifying a transient as a system error creates pager fatigue. Misclassifying a system error as transient hides real bugs. Get this right at the source.

## Alerts

Alert on **symptoms**, not causes. "P95 latency > 500ms for 5 minutes" is a symptom; "CPU > 80%" is a cause and may be fine. Alert on the symptom; use the cause-level metric for diagnosis.

Every alert answers: who pages, what runbook, what's the SLO it's protecting. An alert without a runbook is technical debt.

## SLOs (lightweight version)

For each user-facing endpoint, pick:
- A **target** (e.g., 99.9% of requests succeed in < 300ms over 28 days).
- An **error budget** (the 0.1%).

Track it. When you burn budget faster than you earn it, slow feature work and fix reliability. This is the entire point of SLOs.
