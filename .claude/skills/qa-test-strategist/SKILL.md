---
name: qa-test-strategist
description: Design valuable, right-sized test plans for a feature — picking the mix of unit, integration, end-to-end, contract, property-based, fuzz, mutation, and AI-eval tests that gives the highest confidence per unit of maintenance cost. Use this skill whenever the user asks to write tests, add coverage, plan a test strategy, decide what to test, audit an existing test suite, or test an AI/LLM feature. Trigger on phrasings like "write tests for X", "how should I test this", "what's missing from our coverage", "are these tests any good", "add evals for the agent", "this test is flaky", or "we don't have any tests for this".
---

# QA Test Strategist

Use this skill to produce a **test plan** before writing tests, and to write tests that are worth maintaining. The default failure mode in testing is not "too few tests" — it is **lots of low-value tests** that are slow, brittle, and lock the implementation in place. This skill exists to push back on that.

The skill is **stack-agnostic**. It picks the *kind* of tests that fit the feature; the user (or another skill) picks the framework.

## Core principle

> Test behavior, not implementation. Test at the boundary where breaking changes hurt users.

Every test costs forever — it has to keep passing through every refactor, every dependency upgrade, every team turnover. A test that doesn't catch real bugs is technical debt that **also** slows you down. Aim for **fewer, more valuable tests** by default.

## When to invoke

- "Write tests for [feature/file/PR]"
- "How should I test this?"
- "Plan a test strategy for X"
- "What's missing from our coverage?"
- "Audit the existing test suite"
- "Add evals for [agent/prompt/LLM feature]"
- "This test is flaky / slow"
- "We don't have tests for this"

## Flow

```
1. Understand the change       ──▶  2. Identify risk areas
                                              │
                                              ▼
                          3. Pick the test mix (cost vs. confidence)
                                              │
                                              ▼
                            4. Write the plan (per-test purpose)
                                              │
                                              ▼
              5. Implement  ──▶  6. Validate (fast, isolated, deterministic)
```

Read only the references that match the kinds of tests on the plan — don't pull all of them.

## Phase 1 — Understand the change

Before you write a single test, you need to know:

- **What's the change?** New feature, bug fix, refactor? The right test mix differs.
- **Who depends on the behavior?** End users, another service, an internal caller? That defines the boundary you're testing at.
- **What's the input space?** Bounded enum, free-form string, untrusted external payload? Bigger spaces argue for property-based or fuzz tests.
- **What's deterministic?** Pure logic is easy. Anything touching network, time, randomness, filesystems, or LLMs needs deliberate handling.
- **What's the blast radius of a regression?** A bug in billing ≠ a bug in a tooltip. Risk drives test investment.

If the user hasn't said and it changes the plan, **ask one focused question**, not a survey.

## Phase 2 — Identify risk areas

For the change, list the failure modes you actually fear. A short, honest list beats a comprehensive one.

Common high-risk areas:
- **Boundary conditions** — empty, one, many, max, off-by-one, unicode, null/undefined.
- **Authorization** — can a caller see/modify what they shouldn't?
- **Concurrency** — race conditions, double-submits, retries.
- **State transitions** — illegal transitions, idempotency under retry.
- **External integrations** — third-party down, slow, returning unexpected shapes.
- **Money, identity, permissions** — anything where a bug isn't recoverable.

Low-risk areas (test lightly or not at all):
- **Trivially correct getters/setters.**
- **Framework code you didn't write.**
- **UI styling / pure presentation** (visual regression testing is a separate question).

## Phase 3 — Pick the test mix

Read `references/strategy.md` for the full decision model. The short version:

| Test type | Best at catching | Cost | Default share |
|-----------|------------------|------|---------------|
| **Static** (types, lint) | Whole classes of bugs, free | Free | Always on |
| **Unit** | Logic bugs in pure functions | Cheap, fast | High when logic is complex |
| **Integration** | Wiring, queries, contracts at boundaries | Medium | Often the highest-value tier |
| **Contract** | Cross-service breakages | Medium | When ≥2 services share an API |
| **End-to-end** | Critical user journeys | Expensive, flaky | Few — only happy paths of money flows |
| **Property-based** | Bugs in input space you didn't think of | Medium | When input space is non-trivial |
| **Fuzz** | Crashes / security bugs on untrusted input | Medium-high | When input crosses a trust boundary |
| **Mutation** | Tests that don't actually test | High (offline) | Audit tool, not CI gate |
| **AI evals** | LLM regressions and capability drift | Medium | Required for any LLM feature |

The mix depends on **where bugs come from in this code** — not on a fixed pyramid/trophy ratio.

## Phase 4 — Write the plan

Output a plan **before** writing tests. Each entry has:

- **Name** — what the test is called, in plain English.
- **Type** — unit / integration / e2e / property / fuzz / eval / contract.
- **What it protects** — the specific failure mode it would catch. If you can't fill this in, don't write the test.
- **Why this layer** — why it lives at this tier instead of one above or below.

Example plan format:

```
## Test plan for: order checkout

1. [unit] cart total: discounts + tax + shipping
   protects: discount stacking math (had a bug here last quarter)
   layer: pure function; cheapest place to pin behavior

2. [integration] POST /orders with insufficient stock returns 409
   protects: stock-check happens before charge, on the real DB transaction
   layer: must run against real DB to catch the lock-ordering bug class

3. [contract] inventory-service expects order.lines[*].sku as string
   protects: silent shape change between services
   layer: cheaper than end-to-end, faster than full integration

4. [e2e] guest user can complete checkout with a saved card
   protects: the one journey that, if it breaks, we lose money
   layer: the only place the full stack is exercised together

5. [eval] support-agent tool selection on 30 curated tickets
   protects: regressions when prompt or model changes
   layer: only place LLM behavior is observable
```

A 5-line plan that names the bug each test catches beats a 50-test suite "for coverage."

## Phase 5 — Implement

For each test type, read the matching reference:

- `references/strategy.md` — pyramid/trophy, risk-based selection, anti-patterns
- `references/unit-tests.md` — AAA, FIRST, what to mock and what not to
- `references/integration-tests.md` — real DB, transaction rollback, fixtures
- `references/e2e-tests.md` — when (rarely), how (small set, stable selectors), flake budget
- `references/contract-tests.md` — consumer-driven contracts, when they replace integration
- `references/property-and-fuzz.md` — properties, generators, fuzz harnesses, mutation testing
- `references/ai-evals.md` — datasets, scoring (programmatic / LLM-judge / human), regression vs. capability
- `references/ci-and-flakiness.md` — gating, retries, quarantine, ownership

Match the existing project's framework. Don't introduce a new test runner or assertion library unless the user asks.

## Phase 6 — Validate (structured emit)

Before reporting the task done, emit the following report verbatim as part of the final response, filling in status and notes for each criterion. This is the **definition of done** for any QA task — do not skip it, even when only one or two tests were added.

Status values:
- `pass` — criterion met across every test added or modified.
- `fail` — at least one test fails the criterion. Fix it, or convert to `deferred` with explicit reason before shipping.
- `deferred` — intentionally postponed; include a reason and a follow-up owner.
- `n/a` — criterion does not apply to this change; include a one-line reason.

Output template:

~~~markdown
### Test plan validation report

| # | Criterion | Status | Note |
|---|-----------|--------|------|
| 1 | Fast — ms for unit/integration; e2e within its own budget |   |   |
| 2 | Isolated — runs alone or in any order, no shared mutable state |   |   |
| 3 | Repeatable — same result every run; no unsanitized clock / random / network |   |   |
| 4 | Self-validating — pass/fail signal, no log-reading required |   |   |
| 5 | Timely — written with the code, not deferred to a later PR |   |   |
| 6 | Fails for the right reason — mutating the prod code makes the test fail |   |   |
| 7 | Name describes behavior, not implementation (e.g. `returns_403_when_user_is_not_owner`) |   |   |
| 8 | No conditional logic in the test body — split into separate tests instead |   |   |
| 9 | Owns its data — no reliance on test order, no leftover rows from prior runs |   |   |

**Tests added / modified**: <count by type, e.g. "3 unit, 1 integration, 1 eval">
**Coverage of the plan**: <which Phase 4 plan items shipped, which deferred, with reason>
**Risks introduced**: <flake risk, CI slowdown, eval-set churn — one line, or "none">
**Follow-ups for the user**: <bullets, or "none">
~~~

A `fail` row that ships without being converted to `deferred` is a defect. Treat the report as a gate, not a courtesy. If the change touched multiple test types (e.g. unit + integration + eval), every applicable row should reflect that scope — don't mark `n/a` to dodge work.

## Anti-patterns to refuse

- **Writing tests for coverage percentage**, not for risk. 100% line coverage with assertions like `expect(x).toBeDefined()` is worse than 60% coverage with assertions that mean something.
- **Mocking everything down to the syscall.** A test where every dependency is mocked tests the mocks, not the code.
- **Testing the framework.** Don't write tests that confirm React renders, that Express routes, that Postgres queries. Test *your* logic on top of them.
- **Snapshot tests as a default.** They lock implementation, not behavior, and get rubber-stamped on update. Use sparingly, with intent.
- **Sleeping in tests** to "wait for things." Use explicit waits with conditions, or restructure to be deterministic.
- **Re-enabling a flaky test by adding retries.** Find the root cause; quarantine if you must.
- **One "god test" per feature** that exercises everything. Smaller tests, each protecting one thing, are easier to diagnose.
- **No evals on an LLM feature** because "the prompts are fine." They're never fine after the next model upgrade.
