# Integration tests

An integration test exercises a slice of the system **with its real collaborators** — real database, real HTTP handler, real serializer, real auth middleware. It does *not* span across services or browsers (that's contract or e2e).

For most backends, this is the **highest-value test tier**. Most production bugs are in the wiring: a missing index, a wrong-shaped query, a forgotten auth check, a serializer that can't handle null. Unit tests don't catch any of those because they mock all of them away.

## Scope: what's in, what's out

In:
- The HTTP handler (or RPC entrypoint) under test.
- The real router, real middleware stack.
- The real database, with the real schema applied via migrations.
- The real serialization / validation layer.

Out:
- Other services. Mock or stub them at the HTTP boundary.
- Third-party APIs. Use a recorded fake or a contract test instead.
- Email / SMS / push providers. Capture in a test double; assert what was attempted.
- The browser / mobile client. That's e2e.

The test should be **a request in, a response out, plus database state checks** — nothing more dramatic than that.

## Use a real database

Mocked databases lie. Real ones tell you about:
- Constraint violations (unique, foreign key, check).
- Type coercion surprises (timestamp tz, numeric precision).
- Index plans (is the query actually using the index you added?).
- Transaction semantics (lock ordering, serialization failures).

Patterns for fast, isolated DB tests:

### Transaction rollback per test (preferred for most stacks)

Each test runs in a transaction that's rolled back at the end. No state leaks; setup is fast.

Caveats:
- Code under test cannot manage its own transactions in a way that conflicts. (Some stacks need savepoints to handle nested transactions cleanly.)
- Doesn't catch bugs that depend on transaction commit (e.g., triggers fired only on commit, listen/notify).

### Truncate / reset per test

Wipe tables (or truncate them) before each test. Slower than rollback but more realistic for code that commits its own transactions.

### Template database / fast clone

Set up a "golden" database once with schema + seed; clone it per test. Postgres's template database feature, or `pg_restore` from a dump, makes this fast. Useful when even rollback is too slow because of fixture setup.

### One DB per worker

Parallel test runners each get their own database (numbered: `app_test_1`, `app_test_2`...). Combine with one of the above strategies for isolation within a worker.

## Fixtures and factories

Hard-coded SQL inserts in every test → fragile. Prefer **factories**:

```
const user = await makeUser({ email: "a@b.com" })       // sane defaults
const order = await makeOrder({ user, status: "open" }) // override what matters
```

Each test states **only what's relevant to it**. The factory fills in the rest with valid defaults. When the schema changes, you fix the factory once instead of every test.

Avoid:
- **One giant `seed.sql` shared by all tests.** Tests start depending on its specific shape. Coupling explodes.
- **Implicit row IDs**. `expect(row.id).toBe(42)` breaks the moment another test inserts something. Look up by business key (email, slug) or use the row you just created.

## Authentication in integration tests

Don't disable auth for tests; you'll miss auth bugs. Instead:
- Provide a helper that creates a user and returns a valid token/cookie/session.
- Tests requiring a specific role create a user with that role.
- Have at least one test per endpoint that asserts unauthenticated returns `401` and unauthorized returns `403`. Authorization bugs are the most common security bug class.

## Time, randomness, external clocks

These should be **injectable** in production code so tests can pin them:

```
function expireSession(now = () => new Date()) { ... }
```

In tests, pass `() => new Date("2026-05-05T00:00:00Z")`. No global mocking, no stale snapshots.

For randomness: seed a generator, or extract the random call as a parameter.

## External services

Three options, in increasing fidelity:

1. **Stub at the boundary.** Replace the HTTP client with one that returns canned responses for the URLs you call. Fast, simple. Works when you only depend on a few endpoints.
2. **Recorded fakes** (VCR-style). Record real responses once; replay them in tests. Realistic; can drift from reality silently. Re-record on a cadence.
3. **Contract test** with the real provider's published contracts (see `contract-tests.md`). Strongest guarantee that you and they agree on the shape.

Don't hit real third-party APIs in CI. Flaky, slow, costs money, leaks credentials in logs.

## Asserting on side effects

Beyond the response body, integration tests often need to assert:

- **Database state**: was the row created with the right values? Was the soft-delete flag set?
- **Outbound calls**: did we call the payment provider exactly once with the right amount?
- **Queue messages**: did we enqueue the welcome-email job?
- **Logs / metrics**: was the `order.created` event emitted? (Useful but easy to over-test — assert at the metric level, not the log-string level.)

For each, prefer a **single explicit check** over reading the entire response body and database. The closer the assertion is to the actual behavior, the less it breaks under unrelated change.

## Speed budget

Per test: tens to hundreds of milliseconds is normal. Multiple seconds is a smell — usually means too much fixture setup, or the test is doing what an e2e test should do.

Whole suite: should be runnable locally in under a few minutes. If it isn't, parallelize per worker DB; if it still isn't, audit which tests have outsized cost (often the fixture setup, not the test itself).

## What integration tests don't catch

- **Cross-service contracts.** Use contract tests.
- **End-to-end user flows in the browser.** Use a small e2e suite.
- **Performance under load.** Use load tests, separately, not in regular CI.
- **Visual regressions.** Separate tooling (visual diffing) if it matters.
- **Unicode / fuzzed input bugs.** Add property-based / fuzz tests on the parsing layers.

## Anti-patterns

- **Mocking the database in integration tests.** Now it's a unit test pretending to be an integration test, with the worst of both.
- **Each test creates its own user with the same email.** Hits a unique constraint when run in parallel; or worse, leaks across tests if rollback isn't clean. Use factories that randomize the unique fields.
- **Shared "let's just test the happy path" tests** that exercise huge swaths of the system. Hard to debug when one breaks. Smaller, narrower tests are cheaper to maintain.
- **Reading from one test's data in another test** ("the user we created in the login test"). Order-dependent and order-fragile.
- **Long fixture chains** (`a -> b -> c -> d -> e`) where the test only cares about `e`. Either factory `e` directly, or accept the chain and don't reach into intermediate state.
