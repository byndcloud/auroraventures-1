# Scalability

Don't optimize before measuring. Don't measure before designing for measurement (see `observability.md`).

## Order of operations when something is slow

1. **Reproduce.** A slow report without a query you can run is a rumor.
2. **Measure.** What's the p95? Where does the time go — DB, network, CPU?
3. **Find the dominant cost.** Speeding up the 10% step doesn't matter when the 80% step is unchanged.
4. **Fix the dominant cost.** Usually a missing index or an N+1 query — not "rewrite in a faster language."
5. **Re-measure.** Confirm the fix, then stop. Don't keep optimizing past the goal.

## Database is almost always the bottleneck

In order of how often it's the answer:

1. **Missing index** on the column(s) in `WHERE` / `ORDER BY` / `JOIN`.
2. **N+1 query** — fetching parent then looping to fetch children one at a time. Fix with a join or a batched IN.
3. **Over-fetching** — `SELECT *` of a wide row when you needed three columns. List columns explicitly.
4. **Lock contention** — long transactions holding row locks. Keep transactions short; do the work outside the transaction when you can.
5. **Connection saturation** — too many app instances each holding a pool. Use a connection pooler (PgBouncer or platform-equivalent) in transaction mode.

Use `EXPLAIN (ANALYZE, BUFFERS)` (or the equivalent) on the actual prod-shaped query before guessing.

## Caching

Cache only after measuring. A cache that masks a slow query lets the slow query rot until the cache fails and the system melts.

Cache layers, from cheapest to most fragile:

- **HTTP caching** — `Cache-Control`, `ETag`, `Last-Modified`. Free, browser/CDN does the work. Use it for anything public and read-heavy.
- **CDN** — for assets and cacheable API responses, edge-located.
- **In-memory cache in the app** — fastest, but per-instance and lost on restart. Good for tiny, hot, mostly-static data (feature flags, config).
- **Shared cache (Redis/Memcached)** — coherent across instances, network-cost. Good for session data, computed views, rate-limit counters.
- **Materialized views** — at the database, refreshed on a schedule or trigger. Good when the read shape is stable but expensive.

### Invalidation

Cache invalidation is the hard part. Patterns:

- **TTL-only** — simplest. Acceptable when staleness for N seconds doesn't matter.
- **Write-through** — update the cache when you write the source of truth. Consistent, more code.
- **Event-driven invalidation** — publish a "this thing changed" event; cache subscribers evict. Scales but adds a dependency.

Pick TTL by default. Move up the ladder only when you have evidence TTL isn't enough.

## Rate limiting

Every public endpoint has a limit (see `auth-security.md`). For scaling specifically:

- **Token bucket** for steady traffic with bursts allowed.
- **Fixed window** is simplest but allows 2x burst at boundary.
- **Sliding window** is the most fair, slightly more expensive.
- **Concurrent request limits** for expensive endpoints (uploads, heavy reports) — limit how many can run at once, not how many start per second.

Apply limits per `(user_id, route)` and `(ip, route)`. Aggressive limits on auth/login.

## Queues and async work

Move work out of the request path when it doesn't need to block the response:

- Sending email/SMS, generating thumbnails, indexing for search, fanning out notifications, anything > a few hundred ms.

Queue requirements:
- **At-least-once delivery** — workers must be idempotent. Plan for the same message arriving twice.
- **Retries with exponential backoff and jitter.**
- **Dead-letter destination** for messages that exceed retry count. Alert on dead-letter depth.
- **Visibility timeout** longer than the worst-case worker run.
- **Poison-message detection** — a message that crashes the worker shouldn't loop forever.

If the platform offers job-style primitives over a single Postgres (`pg_cron`, `LISTEN/NOTIFY`, table-based queues with `FOR UPDATE SKIP LOCKED`), use them before adding a separate broker. One database is easier to operate than two systems.

## Backpressure

When downstream is slow, options in increasing severity:
1. Buffer (queue grows). Bounded buffer.
2. Shed load (return `429` / `503` early).
3. Degrade (return cached or partial results).
4. Fail fast (circuit breaker opens).

Decide which at design time per dependency. The wrong default — buffer unboundedly — is what turns a slow dependency into an outage.

## Scaling shape

- **Vertical first.** Bigger instance, more RAM, faster disk. Cheap and simple.
- **Read replicas** for read-heavy workloads. Direct read traffic to replicas; writes still go to primary. Mind replication lag for read-your-writes flows.
- **Horizontal stateless** — add more app instances behind a load balancer. Requires session state to live elsewhere (DB, cache).
- **Sharding / partitioning** — last resort, lots of operational complexity. Only when a single primary genuinely can't keep up with writes. Pick the shard key carefully — it's the hardest schema change to undo.

Most apps scale very far on a vertically-scaled primary database + horizontally-scaled stateless app tier + a cache. Don't reach for sharding or microservices to solve a problem you don't have yet.

## Indexing for scale

(See `data-modeling.md` for index basics.) At scale specifically:

- Watch index bloat — periodic `REINDEX CONCURRENTLY` on hot tables.
- Watch unused indexes (monitor `pg_stat_user_indexes`); they cost writes for no gain.
- Composite index column order matters: most-selective and equality-filtered columns first, range columns last.
- A covering index (`include (...)`) can let the query plan stay in the index without hitting the heap.
