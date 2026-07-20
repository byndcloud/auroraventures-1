# End-to-end tests

End-to-end tests drive the **whole stack** through the user-facing surface — usually a real browser hitting a deployed (or test-mode) app. They are the most expensive tests you have and the closest to "what users do."

The right number of e2e tests for most products is **a small number**, often 3–10. If your e2e suite is large, most of those tests are catching bugs that cheaper layers should catch — or they're not catching bugs at all.

## When e2e earns its keep

Reserve e2e for:

- **Money-path journeys** — signup, login, checkout, billing changes. If these break, the company loses revenue or trust before the next deploy.
- **Cross-page workflows** — flows that span multiple pages or routes and integrate front + back. A unit/integration test can't catch that the redirect after step 2 lands on the wrong page.
- **Smoke** — does the app actually load and respond? One test per environment, gated as "deploy succeeded" rather than "feature works."

Don't use e2e for:
- **Form validation rules.** Unit-test the validator.
- **Every error message.** Integration-test the handler.
- **Permutations** of UI state (10 button colors). Unit/component-test.
- **Performance.** Load tests, separately.

## The cost you pay

- **Slow.** Seconds to minutes per test. Suites of dozens become tens of minutes of CI.
- **Flaky.** Real browsers, real timing, real network. Even a 1% flake rate becomes ~10% across a 10-test suite.
- **Hard to debug.** A failure tells you "checkout broke," not which line. You'll spend hours bisecting.
- **Hard to keep stable across UI changes.** Selector churn, layout shifts, animation timing all break tests that worked yesterday.

Every e2e test must be worth this cost. If you can't name a real bug it would catch that integration tests wouldn't, delete it.

## How to write e2e tests that don't melt

### Selectors: stable, semantic, intentional

In rough order of preference:

1. **Test IDs** added explicitly: `data-testid="checkout-submit"`. The element exists for the test; the test won't break when CSS changes.
2. **Accessible roles + names**: `getByRole('button', { name: 'Submit order' })`. Doubles as an accessibility check.
3. **Text content**: brittle to copy changes; only for unique stable strings.
4. **CSS selectors**: `div.checkout > .btn-primary:nth-child(2)`. Last resort. Will break.

### Wait for conditions, not durations

`sleep(500)` is the most common cause of e2e flake. Replace every sleep with a wait-for:

- "wait for this element to appear"
- "wait for this network call to complete"
- "wait for this URL to match"

Most modern e2e frameworks (Playwright, Cypress) have first-class auto-waiting. Use it. If your framework doesn't, write a `waitFor(() => predicate())` helper with a sane timeout, and never call sleep directly.

### Independent tests

Each test resets its own state:
- Creates its own user (with a randomized email).
- Tears down or rolls back what it did.
- Doesn't depend on a previous test having logged someone in.

A failure in test 3 should not cascade into tests 4–10 also failing.

### Network: real or stubbed?

Two valid approaches:

- **Real backend, test database.** Highest fidelity; slowest. Needed when you're testing the integration of front + back.
- **Stubbed backend** (intercept network calls, return canned responses). Fast; misses real backend changes. Useful when testing pure frontend flows or when the backend is unavailable.

Don't stub *some* calls and let others hit real services unintentionally. Be explicit.

### Test environment

- Dedicated environment, not shared with humans.
- Seeded to a known state at the start of each run, or each test creates what it needs and cleans up.
- Feature flags pinned (you don't want a test to break because someone toggled a flag).
- Time can be controlled (server accepts a `?test_time=` parameter, or the test environment uses a clock service).

## Flake budget

Set an explicit budget: e.g., "no more than 1% flake rate per test, measured over 100 runs." Tests that exceed it go into **quarantine** (run, but don't gate the build) until fixed or deleted. Quarantine is **not** a permanent home — there's a deadline.

Common flake sources, ordered by frequency:

1. Implicit timing (animations, async rendering, debounced inputs).
2. Selectors matching the wrong element after layout changes.
3. Test data leaking between tests (especially in parallel runs).
4. Network instability (third-party calls, rate limits).
5. Browser quirks (especially headless vs. headed).

Each flake gets a root cause and a fix. **Adding `retry: 3` is hiding the bug**, not fixing it.

## Parallelism

E2e suites should run in parallel by default — otherwise the wall-clock time is a productivity tax on the team. Each parallel worker needs:
- Its own browser instance (most frameworks handle this).
- Its own user / data namespace (factories that randomize unique fields).
- A safe-to-share or sharded backend.

## Visual regression

A specialized form of e2e: take a screenshot, diff against a baseline. Earns its keep for design-system components and high-traffic marketing pages where visual changes are themselves regressions.

Doesn't earn its keep when:
- Snapshots regenerate on every minor render change (font hinting, antialiasing) — review fatigue sets in.
- The diff tooling lacks tolerance controls and produces noise.

If you adopt it, scope it tightly to a few pages/components and treat snapshot updates with the same scrutiny as code review.

## Anti-patterns

- **An e2e test for every feature.** Most features should not have an e2e test.
- **`cy.wait(2000)` / `await page.waitForTimeout(2000)`.** Replace with a condition-based wait.
- **Re-runs as a flake mitigation.** Useful as a stop-gap; lethal as a permanent strategy.
- **Selectors tied to CSS classes** with build-time hashing (`.btn-a8f3c1`). They change every deploy.
- **Mixing real and stubbed network unintentionally.** A test that hits prod by accident is a real outage waiting to happen.
- **End-to-end tests as the only tests.** Costly to run, costly to maintain, and they push diagnosis cost onto whoever broke them.
