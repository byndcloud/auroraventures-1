# Strategy: picking the right test mix

The classic shapes (pyramid, trophy, honeycomb) are heuristics, not laws. They all encode the same truth: **the cost of a test increases with how much of the system it exercises**, and so does its blast radius when it breaks. The optimum depends on where bugs actually come from in *your* code.

## The three shapes, briefly

- **Pyramid** (lots of unit, fewer integration, very few e2e). Best for systems with rich domain logic and stable boundaries — backends with complex business rules.
- **Trophy** (static + many integration + some unit + few e2e). Best for code that's mostly glue between libraries — frontends, thin services. The argument: unit-testing glue mostly tests the mocks.
- **Honeycomb** (small unit + dominant integration + small implementation-detail tests). Microservices: most bugs live in how services interact, not inside any one service.

Don't argue the shapes. Ask: **"where are our last 10 production bugs from?"** The answer tells you which layer is under-invested.

## Risk-based selection

For each candidate behavior, score:

- **Likelihood** — how likely is a regression here? Touched often, complex logic, untrusted input → higher.
- **Impact** — what does the bug cost? Money loss, data leak, broken auth → higher.
- **Detectability without tests** — would you notice in prod immediately, or only when a customer screams?

Test investment scales with `likelihood × impact / detectability`. A high-impact, easily-missed regression deserves multiple layers. A low-impact, instantly-visible bug may need none.

## Cost model per test

Every test has four costs:

1. **Write cost** — time to author. One-time.
2. **Run cost** — CPU/wall time on every CI run. Multiplies with frequency.
3. **Maintenance cost** — every refactor, every dependency upgrade. Compounds with codebase age.
4. **Failure cost** — when it breaks falsely (flake) or for unrelated reasons. Scales with how much state it touches.

Unit tests minimize 2, 3, 4 but only catch a narrow class of bugs. End-to-end tests catch the most realistic bugs but maximize 2, 3, 4. The right answer is rarely "all of one kind."

## Where each test type earns its keep

### Static analysis (types, lint, formatters)

The cheapest test you'll ever run. Catches whole categories of bugs (null deref, type confusion, unused imports) without writing a single test. **Always on.** If the project has a typechecker, run it in CI; if it has a linter, run it in CI.

### Unit tests

Earn their keep when:
- The function has **non-trivial logic**: branching, math, algorithms, state machines.
- The function is **pure or easily made pure** (no I/O, or I/O parameterized away).
- Multiple input cases need to be checked rapidly.

Don't earn their keep when:
- The function is mostly orchestration (call A, then B, then C). Test that end-to-end at the integration tier.
- Every interesting behavior requires mocking 5 collaborators. The mock setup *is* the test, and it ages worse than the code.

### Integration tests

Often the **highest-value tier**, especially in backend code. Earn their keep when:
- Behavior emerges from interaction with a real database, queue, or external system.
- The contract you care about is "the HTTP handler does the right thing end-to-end inside this service."
- Wiring/configuration bugs (missing index, wrong serializer, missing auth middleware) would slip past unit tests.

Run against a **real Postgres**, not a mock. Use transaction rollback per test for isolation.

### Contract tests

Earn their keep when **two or more services** share an API. Cheaper than spinning up both services together, more accurate than independent unit tests on each side. The contract describes a concrete request/response example the consumer relies on; the provider verifies it on every change. See `contract-tests.md`.

Don't earn their keep when there's only one consumer and it lives in the same repo — just write integration tests.

### End-to-end tests

Few. **Critical user journeys only**: signup, checkout, the one or two flows that, if broken, the company calls an incident.

Reasons to keep the count small:
- They are slow (minutes per test in aggregate → hours of CI).
- They are flaky (real browsers, real network, real timing).
- A failure rarely points to the cause; you debug from the symptom.

Three to ten e2e tests per product is often plenty. If the suite is bigger than that, ask which ones have ever caught a bug that other layers missed.

### Property-based tests

Earn their keep when:
- The function has a **property** that should hold for all inputs in a defined space (`encode(decode(x)) === x`, `sort` returns a permutation in non-decreasing order, etc.).
- The input space is too big to enumerate.
- You want bugs you didn't think of, not bugs you already fixed.

The cost is mostly the input generators. Once written, they run on every CI for free. See `property-and-fuzz.md`.

### Fuzz tests

Earn their keep at **trust boundaries**: parsers of untrusted input, anything that consumes user-uploaded files, anything reachable from the public internet without auth. The goal is "doesn't crash, doesn't hang, doesn't leak memory" on adversarial input — not "produces the right answer."

### Mutation testing

A meta-test: it mutates your production code and checks whether your tests catch it. If they don't, the test was decoration.

Mutation testing is **not a CI gate** — it's slow and noisy. Use it as an **audit** on critical modules: run quarterly, look at surviving mutants, decide if they're real test gaps or acceptable.

### Snapshot tests

Use sparingly, with intent. They earn their keep for:
- **Stable structured output** that's easier to inspect visually than to assert field-by-field (a generated SQL string, a normalized AST).

They fail to earn their keep when:
- Devs rubber-stamp every snapshot update without reading the diff. Now the test does nothing except slow CI.
- They snapshot HTML/JSX deeply — they'll regenerate on any unrelated style tweak.

### AI evals

Required for any LLM feature. Unlike code tests, the system under test is non-deterministic, so the framing differs: you're measuring **how often** the agent behaves correctly on a curated dataset, not **whether** it does on a single input. See `ai-evals.md`.

## Anti-patterns

- **Coverage as a goal.** 100% coverage with weak assertions is worse than 60% coverage with sharp ones. Coverage tells you what *might* be tested; it can't tell you what *is*.
- **Testing implementation details** (private methods, internal state, render order). When you refactor without changing behavior, the tests should still pass. If they don't, they were testing the wrong thing.
- **One assertion per test, religiously.** Sometimes one behavior has multiple consequences; asserting them together in one test is fine. The rule is "one *behavior* per test," not one assertion.
- **Shared mutable test fixtures.** Order-dependent test suites are a category of bug, not a feature.
- **"Add tests later" PRs.** Later never comes. Tests are written with the code that needs them — for new code that's untested for a reason (spike, prototype), that reason should be in a comment.
- **Treating test code as second-class.** Test code is read more than it's written. Refactor it. Name things. Extract helpers. Apply the same standards as production code.
