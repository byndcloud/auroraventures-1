# CI integration and flakiness

A test suite that doesn't run in CI doesn't exist. A test suite that runs in CI but flakes randomly is worse than no suite at all — it trains the team to ignore failures, and real regressions slip through.

## Pipeline shape

Run tests in **tiers**, fastest first. Each tier blocks the next:

1. **Static** — types, lint, format check. Seconds. Catches the dumbest mistakes free.
2. **Unit** — milliseconds per test, seconds for the suite. Run in parallel.
3. **Integration** — seconds per test, minutes for the suite. Parallelize per worker DB.
4. **Contract** (provider-side) — verify against current consumer contracts.
5. **End-to-end** — minutes for the suite. The smallest set you can get away with.
6. **AI evals (regression)** — block merge on regressions; capability evals can be advisory.

Each tier failing should give the developer the most actionable possible feedback before the next tier even starts. **Don't** start an e2e run that takes 10 minutes when the unit tests already failed.

## Gating: what blocks merge?

- **Required**: static, unit, integration, contract (provider side), regression evals. These are deterministic enough that "red = real failure" is true.
- **Required with care**: e2e. Flake budget is real; if you can't keep flake under ~1%, e2e gates the build less than it should.
- **Advisory**: capability evals, mutation testing, fuzzing. They run, but reds open issues rather than block merges.

A good rule: if the failure mode is "the test is flaky," it shouldn't be required. Either fix the flake, quarantine the test, or move it to advisory.

## Flake handling

A flake is a test that gives different results on the same code. Sources, in order of frequency:

1. **Implicit timing** — sleeps, race conditions, animations, async operations not waited on.
2. **Test isolation leaks** — leftover DB rows, leaked global state, file system artifacts, shared caches.
3. **Order dependence** — test A passes only when test B ran first.
4. **Network instability** — third-party calls, DNS, rate limits.
5. **Resource contention in parallel** — port conflicts, DB connection limits, CPU starvation.
6. **Nondeterministic data** (`Date.now()`, `Math.random()` unseeded, `Map` iteration on some runtimes).

### The flake protocol

When a test flakes:

1. **Reproduce locally.** Run it 100 times in isolation. Run it 100 times after the test before it. If it flakes locally, you found it.
2. **Check the failure mode.** Most flakes look the same: timing-related selector miss, missing await, unsanitized state.
3. **Fix the root cause** — never add `retry: 3` and call it done. Retry hides the bug; the bug is still there.
4. **If you can't fix it now, quarantine** the test (mark as non-required, file an issue with deadline). Quarantine has a deadline — 1 sprint, max — after which the test is fixed or deleted.

### What "quarantine" looks like

```
test.skip("flaky: tracked in #1234", ...)   // simplest
// or
test.flaky("tracked in #1234", ...)         // some frameworks support this
```

Quarantined tests still **run** (so you have data on whether the flake is real or fixed) but do not gate the build. After the deadline:
- If still flaky: delete it. A test you can't run is not a test.
- If no longer flaky: re-promote to required.

## Retries

There is **one** legitimate retry pattern in CI: retrying e2e tests up to N=2, **and only when** you also count the retry rate as a separate signal that something is wrong.

Retrying integration or unit tests is admitting you don't trust your own framework. Don't.

## Test ownership

Every test has an owner — the team or person who fixes it when it breaks.

- A failing test with no owner sits red for weeks while everyone "doesn't know if it's mine."
- An owner is named in the test file or in a `CODEOWNERS`-style file.
- When a test fails on someone else's PR, the owner triages, not the PR author.

Without ownership, the test suite rots. Tests are deleted "because they were always failing" by people who don't know what they protected.

## Speed budget

Set explicit budgets and enforce them:

| Tier | Budget |
|------|--------|
| Static | < 1 min |
| Unit suite (parallel) | < 2 min |
| Integration suite (parallel) | < 5 min |
| Contract verification | < 2 min |
| E2E suite | < 10 min |
| **Total to "merge eligible"** | **< 15–20 min** |

Past 20 minutes, developers context-switch and stop watching their PRs through to green. Past an hour, the suite becomes something you batch overnight, which means trunk goes broken silently.

When you exceed the budget:
- **Parallelize first.** Most CI runners scale horizontally; most test frameworks shard.
- **Profile second.** Find the 10% of tests using 60% of time. Often a fixture is too heavy or a setup runs per-test that should run per-suite.
- **Cut third.** Tests that haven't caught a bug in a year and aren't covering critical logic are candidates for deletion.

## Observability of the test suite

Treat the test suite as a system with metrics:

- **Pass rate per test, over time.** A test going from 100% to 95% pass rate is a flake brewing.
- **Wall-clock time per test, over time.** A test getting slower may have a memory leak or an N+1 in the fixture.
- **Suite-level wall-clock time.** Trends matter.
- **Most expensive tests.** Top 20 by time. Optimize the top of the list, not the average.
- **Quarantined tests, by age.** If anything is quarantined > 30 days, it's dead.

## Pre-commit and pre-push

Lighter-weight than CI:

- **Pre-commit**: run formatters, linters on changed files. Fast feedback, no excuse to skip.
- **Pre-push**: run unit tests for changed packages. Catches "I forgot to run tests" before CI.

Don't put integration or e2e tests in pre-push hooks; they're too slow and people will start using `--no-verify`. Hooks that get bypassed routinely are not a safety mechanism, they're noise.

## Test data in CI

- **Ephemeral**. Each CI run creates and tears down its own data. No "the staging DB has the right state."
- **Reproducible.** Same seed, same schema, same fixtures. A failure on CI must be reproducible by re-running with the same SHA.
- **Isolated per worker.** Parallel workers don't share data. Either separate databases per worker, or namespacing.

## Anti-patterns

- **"It works locally."** Means the test depends on local state CI doesn't have. Find what.
- **Disabling tests instead of fixing them**, with no follow-up. Now you have less coverage *and* unfixed bugs.
- **Running the full suite for every commit on every branch.** Use change-affected test selection on big monorepos; full suite on merge to trunk.
- **CI as the only place tests run.** Developers should be able to run subsets locally in seconds. If they can't, no one will write tests.
- **Tests sharing a single hardcoded test user / hardcoded test ID.** Parallel runs collide; one test's failure cascades.
- **Treating green CI as proof of correctness.** Green CI means "the tests we have passed." It doesn't mean "the code is correct" — that's a function of how good the tests are. Don't conflate.
