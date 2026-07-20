# Contract tests

A contract test verifies that **two services agree on an API** without spinning both up together. Cheaper than full integration, more accurate than each side mocking the other independently. The most common style is **consumer-driven contracts** (Pact, Spring Cloud Contract, etc.).

## When contract tests earn their keep

- Two or more services share an API and live in different repos / deploy independently.
- "Did our last deploy break the mobile app?" is a question you actually ask.
- The integration test alternative is "spin up both services in CI" and that's slow/expensive enough to skip.

When they don't:
- The consumer and provider are in the same repo, deployed together. Just write integration tests.
- There's only one consumer and you control both sides — contract tests add ceremony without much benefit.
- The "API" is a third-party you don't control and they don't publish contracts. Use recorded fakes or a small live-integration smoke test instead.

## How consumer-driven contracts work

The flow is asymmetric on purpose:

1. **Consumer test** runs against a **mock provider**. As a side effect, it generates a **contract file** describing the exact requests it makes and the responses it expects.
2. The contract file is published to a **broker** (a shared store).
3. **Provider test** replays the contract: it spins up the real provider against test data, plays back each recorded request, and asserts the response matches what the consumer expects.
4. If a provider change breaks any consumer's contract, CI fails — *before* deploy.

The consumer is the source of truth for what the API needs to do. The provider verifies it can deliver.

## Writing good consumer contracts

The hardest skill is **knowing what *not* to assert**.

A contract should pin only what the consumer **actually depends on**. Every extra assertion locks the provider in for no benefit:

- The consumer reads `response.user.email` → assert that field exists, is a string, matches an email shape.
- The consumer doesn't read `response.user.created_at` → don't mention it. If you assert on it, the provider can't add or rename internal fields without breaking you.

Pact-style matchers exist for exactly this:
- "is a string" (not "equals 'foo@bar.com'")
- "is an array of N items, each matching this shape"
- "matches this regex"
- "is a UUID / timestamp / int"

Use them aggressively. The contract is **shape, not values**.

### Example shapes

Bad (over-specified):
```
{
  "id": "ord_abc123",
  "user_id": "usr_xyz789",
  "total_cents": 4500,
  "status": "open",
  "items": [{ "sku": "SKU-001", "qty": 2 }],
  "created_at": "2026-05-05T14:32:00Z"
}
```
Provider can't change anything without coordinating with every consumer.

Good (consumer-driven, pinning only what matters):
```
{
  "id": like("ord_abc123"),                 // consumer needs the field; value is illustrative
  "total_cents": integer(),                  // consumer rounds and formats; cares it's an int
  "status": term(/open|closed|cancelled/),   // consumer branches on this set
  "items": eachLike({                        // consumer iterates; cares each item has these
    "sku": like("SKU-001"),
    "qty": integer()
  })
}
```

Notice what's missing: `user_id`, `created_at`. The consumer doesn't read them, so they don't appear.

## Provider verification

The provider runs the contract against itself. To make this robust:

- **Provider states** — the contract may say "given a user with id usr_xyz exists, when I GET /users/usr_xyz, expect ...". The provider must implement a setup hook that creates that state. Don't reach into the database from the test; expose a state-setup API.
- **Realistic data** — providers shouldn't return data that only exists for the test, or contracts won't catch real-world drift.
- **Run on every change** — the contract verification belongs in the provider's CI, not as a once-a-quarter check.

## Versioning and the broker

The broker stores contracts tagged by version (or branch). The deploy gate is "is the version I'm deploying compatible with the versions of consumers currently in production?" Pact calls this `can-i-deploy`. Without it, you have a contract test in name only.

## Common mistakes

- **Treating contract tests as integration tests.** They are not — they don't verify business logic, they verify shape. Don't try to use them to test that "creating an order decrements stock"; that's an integration test.
- **Asserting on every field "for thoroughness."** That's not consumer-driven; that's a snapshot test in a contract's clothes.
- **Contracts not published / not verified.** A contract file sitting in a repo nobody verifies is documentation, not a test.
- **Skipping provider states** and relying on whatever data happens to be in the test DB. Tests pass locally, fail on a colleague's machine.
- **Contracts as a substitute for talking to other teams.** They surface breakages; they don't replace the conversation about *whether* a breaking change should happen.

## Contract testing for events / queues

The same idea extends beyond HTTP: a publisher and subscriber can have a contract about message shape on a queue or topic. The mechanics are similar — consumer expectations recorded, provider verifies — but tooling is less mature than for HTTP. Schema registries (Avro, Protobuf) are the lightweight version: they enforce shape compatibility but not semantics.
