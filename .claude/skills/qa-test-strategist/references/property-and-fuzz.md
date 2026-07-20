# Property-based testing, fuzzing, mutation testing

Three distinct techniques that get conflated. They answer different questions:

| Technique | Question it answers |
|-----------|--------------------|
| **Property-based** | Does my code hold an invariant across all valid inputs? |
| **Fuzzing** | Does my code crash / hang / corrupt memory on adversarial input? |
| **Mutation** | Are my tests actually catching bugs, or just running? |

## Property-based testing

You describe the **input space** and a **property that should hold** for all inputs in it. The framework generates inputs, checks the property, and shrinks failing cases to a minimal counterexample.

When it earns its keep:
- The function has an invariant: round-trip (`decode(encode(x)) === x`), idempotency (`f(f(x)) === f(x)`), commutativity, monotonicity, conservation (`sort(xs)` is a permutation of `xs` and is non-decreasing), bounds (`0 ≤ result ≤ N`).
- The input space is too big to enumerate but small enough to describe.
- You want bugs **you didn't think of**.

When it doesn't:
- The function has no easily-stated property (most CRUD code).
- The property is "behaves like this oracle" and the oracle is the function itself. You'll prove a tautology.

### Useful property patterns

- **Round-trip** — encoding/decoding, serializing/parsing, marshal/unmarshal. `parse(format(x)) === x`.
- **Inverse** — `inverse(f(x)) === x`. Decryption, unzip, undo.
- **Idempotence** — `f(f(x)) === f(x)`. Setting a value, normalizing input.
- **Invariants** — properties that must hold of any output: "result is sorted," "result has the same multiset of elements," "balance is non-negative."
- **Comparison with a slow but obviously correct reference** — fast vs. naïve implementation must agree.
- **Metamorphic relations** — when you can't say "the right answer" but you can say "given input transformation T, output should also be transformed by T'." Common in scientific code.

### Generators

The bulk of the work is the generators — functions that produce realistic inputs from the input space. Reuse generators across tests; treat them like fixtures. Compose small generators (a `User` generator from a `Name` generator and an `Email` generator).

Bias generators toward **boundaries**: include zero, one, max, empty, very large, unicode edge cases. The framework usually handles primitives well; you're responsible for domain-specific shapes.

### Shrinking

When a property fails, the framework reduces the failing input to a minimal example. This is the killer feature — instead of "failed on this 4KB JSON blob," you get "failed on `[]`." Make sure shrinkers are wired up; for custom types you may need to define one.

### Cost

Property tests are slower than unit tests (usually 100s–1000s of cases per property). Run them in CI with a fixed (smaller) sample count and keep a regression file of past failures replayed first. Run with bigger sample counts overnight or on a nightly job.

## Fuzz testing

Fuzzing throws **random or mutated input** at code and watches for crashes, hangs, asserts, memory errors, or panics. It's not asking "does the result match an oracle" — it's asking "does anything bad happen."

When it earns its keep:
- **Trust boundaries** — anything that parses untrusted input from the network, files, or users.
- **Languages or layers where memory safety matters** — C, C++, FFI calls, native modules.
- **Long-lived parsers** that have accumulated edge cases (config files, custom DSLs, file format readers).

Fuzzing styles:

- **Random / generation-based** — generate inputs from scratch, optionally guided by a grammar. Good for protocols with known formats.
- **Mutation-based** — start with a corpus of valid inputs and mutate them (flip bits, drop bytes, splice). Cheap to set up; coverage is bounded by the seed corpus.
- **Coverage-guided** (libFuzzer, AFL, Go's native fuzz, Python's Atheris) — observe code coverage at runtime, prefer inputs that find new branches. The strongest general-purpose fuzzer.

### Setting up a fuzz harness

A fuzz target is a function that takes raw bytes and exercises the code under test:

```
fuzz(data: bytes) -> None:
    try:
        result = parse_user_input(data)
        # Optional: assert invariants on result
    except ExpectedException:
        pass  # The library declared this exception
    # Any other exception, crash, or hang is a finding
```

Keep the harness fast (each iteration runs millions of times) and deterministic (no global state).

### What a fuzzer finds

Real classes of bugs fuzzers find that other tests miss:
- Stack overflows from deeply nested input.
- Integer overflows / underflows.
- Resource exhaustion (a 10-byte input that allocates 10GB).
- Infinite loops on adversarial inputs.
- Memory safety bugs (in non-memory-safe languages).
- Panics / unhandled exceptions on inputs you didn't anticipate.

Fuzzing is **not** for "does this return the right answer" — that's property-based testing's job.

### Cost and lifecycle

Fuzzers run continuously, not as part of every PR. Standard pattern:
- Fuzz harnesses live in the repo.
- A nightly or always-on fuzzing job runs them.
- Crashes / new findings are filed as bugs.
- The seed corpus grows over time as new interesting inputs are discovered.

CI runs a brief regression check (replay all known crashes) on every PR — quick and prevents reintroducing fixed bugs.

## Mutation testing

Mutation testing **changes your production code** in small ways (flip a `<` to `<=`, replace a constant with zero, delete a return) and runs your test suite. If the suite still passes, the mutant **survived** — meaning your tests didn't actually require the original behavior.

This is the most direct measurement of test quality available. Coverage tells you what *executed*; mutation testing tells you what *was meaningfully checked*.

### When it earns its keep

- **Auditing critical modules** — billing math, auth, anything where a silent regression would be catastrophic.
- **Detecting test rot** — tests that pass after refactors that should have broken them.
- **Identifying weak assertions** — `expect(x).toBeDefined()` vs. `expect(x).toBe(42)`.

### When it doesn't

- **As a CI gate.** Mutation testing is slow (the test suite runs once per mutant; suites with hundreds of mutants take hours). Don't gate every PR on it.
- **On code that doesn't need it.** A glue function with a 1-line test doesn't benefit; a state machine does.

### How to use it

1. Run mutation testing on a target module overnight or in a nightly job.
2. Look at **surviving mutants**. For each:
   - Real test gap → add a test.
   - "This mutant is equivalent to the original" (e.g., `< 0` vs. `<= 0` when 0 can never appear) → mark as equivalent or change the assertion to be specific.
   - Mutant in untested error path you've decided is acceptable → document; move on.
3. Track mutation score (% killed) on critical modules over time. Don't chase 100% — chase "the mutants we let live are explained."

## Anti-patterns

- **Property tests with the function under test as its own oracle.** Always passes; proves nothing.
- **Generators that exclude the interesting cases** (no empties, no boundaries, no unicode). The bug is exactly there.
- **Fuzzing without a corpus.** You'll mostly hit the "rejects garbage" early-return branch and find nothing deep. Seed with realistic inputs.
- **Treating mutation score as a target.** It's a diagnostic. Optimizing the score without thinking yields tests that catch synthetic mutants and not real bugs.
- **Running fuzz tests as blocking CI.** They can run for an unbounded time; don't put them on the critical path. Crash regressions go on the critical path.
