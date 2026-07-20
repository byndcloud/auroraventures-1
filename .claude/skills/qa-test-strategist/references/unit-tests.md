# Unit tests

A unit test exercises a small piece of code in isolation, **fast**, with no I/O. Its job is to pin down the logic of a function or class so that future changes can't silently break it.

Unit tests are cheap to run and cheap to keep — *if* the unit you're testing is well-shaped. If you find yourself wiring up a database, a network call, or a clock just to write a "unit" test, the unit isn't well-shaped yet. Either refactor (parameterize the dependency) or write the test at the integration tier.

## Shape of a good unit test

### AAA — Arrange, Act, Assert

```
test("discount applies before tax")
  // Arrange — set up just what this test needs
  const cart = makeCart([{ price: 100, qty: 2 }])
  const discount = pct(10)

  // Act — one call, the thing under test
  const total = checkout(cart, { discount, taxRate: 0.1 })

  // Assert — one behavior, possibly multiple expectations on it
  expect(total.subtotal).toBe(180)
  expect(total.tax).toBe(18)
  expect(total.grand).toBe(198)
```

Three sections, blank line between them, no surprises in any of them.

### FIRST

- **Fast** — milliseconds. A unit test that takes 200ms is wrong-shaped (probably hitting I/O).
- **Isolated** — no shared mutable state with other tests. Can run alone or in any order.
- **Repeatable** — same result every run, every machine. No `Date.now()`, no `Math.random()` without a seed, no network.
- **Self-validating** — pass or fail, never "look at the log."
- **Timely** — written with the code, not bolted on three sprints later.

## Naming

Test names describe **behavior**, not implementation. The name should read like a spec line.

Good:
- `returns_zero_for_empty_cart`
- `rejects_email_without_at_sign`
- `caches_result_until_ttl_expires`

Bad:
- `test_calculate_total_v2`
- `it_works`
- `test_handler` (which handler? what about it?)

A useful trick: if you can't write a clear name, you don't yet know what behavior you're pinning.

## What to test

The high-value cases for any function:

1. **Happy path** — the obvious, expected use.
2. **Boundary cases** — empty, one, many, max-1, max, max+1.
3. **Error paths** — what happens with invalid input, with a dependency that throws.
4. **State transitions** — for stateful code, illegal transitions and the reachable states.
5. **Regression cases** — every bug you fix gets a test that would have caught it.

You don't need cases for "what if we pass `null`" if the type system already forbids it. Don't write tests that exist only because the language is dynamic — let the typechecker do that work.

## What to mock (and what not to)

Mock when:
- The dependency is **slow** (network, disk, sleep).
- The dependency is **non-deterministic** (clock, random, external service).
- The dependency has **side effects** you don't want in a test (sends email, charges a card).
- The dependency is **the boundary** you're testing against — e.g., you're testing your code's behavior given a third-party returning a 500.

Don't mock when:
- The "dependency" is a pure helper you wrote. Just call it. Mocking your own pure code tests the mock.
- You'd have to mock 5+ things to get one test to run. The unit is too big or too coupled. Refactor.
- The behavior under test only emerges from interacting with the real thing (a query, a transaction). Move to integration.

### Mock vs. fake vs. stub

- **Stub** — returns canned values. Cheapest, most common.
- **Fake** — a working in-memory implementation (e.g., an in-memory KV instead of Redis). Best when behavior must be realistic.
- **Mock** — records calls and asserts on them. Use when the *interaction itself* is the behavior under test (`emailService.send was called once with subject="..."`). Otherwise prefer stubs/fakes.

Asserting on mock calls couples the test to implementation. If the test breaks every time you refactor without changing behavior, the assertions are too tight.

## Pure functions are unit-test gold

The cheapest, most durable tests are over **pure functions** — same input, same output, no side effects. Whenever you can, push logic into a pure function and parameterize the I/O at the edges. That's the difference between a unit test that ages well and one that turns into mock-management.

```
// Hard to unit test — I/O, time, randomness all entangled
function chargeCard(userId) {
  const user = db.users.find(userId)
  const cents = computePrice(user, Date.now())
  return stripe.charge(user.cardId, cents)
}

// Easy — pure logic split out
function priceFor(user, now) { /* ... */ }     // unit-test heavily
function chargeCard(userId) {                   // integration-test once
  const user = db.users.find(userId)
  return stripe.charge(user.cardId, priceFor(user, Date.now()))
}
```

## Parameterized / table-driven tests

When the same behavior is tested across many inputs, use table-driven form. One test definition, many cases:

```
each([
  ["empty", "", false],
  ["no @",   "foo",  false],
  ["double @", "a@@b.com", false],
  ["valid",  "a@b.com", true],
])("isEmail(%s)", (label, input, expected) => {
  expect(isEmail(input)).toBe(expected)
})
```

Beats five copy-pasted tests. The failure message includes the row that failed.

## Anti-patterns

- **Asserting on logs/console output** as the test signal. Logs are for humans, not assertions. Assert on return values or state.
- **`expect(true).toBe(true)`** at the end of a try/catch as a "no error" assertion. Use the framework's exception-expectation helper, or restructure.
- **Test code that's longer than the code under test, all in setup.** Sign of a missing abstraction or of testing the wrong layer.
- **Conditionals in tests.** `if (env === 'ci') skip(...)` is a smell — the test should pass in both, or there should be two tests.
- **Time-based assertions** like `expect(elapsed).toBeLessThan(50)`. Almost always flake. Test correctness; measure performance separately.
- **Reaching into private state** to assert on it. If a behavior matters, it's observable through the public API. If it isn't observable, why does the test care?
