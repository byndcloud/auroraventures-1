# Access control (the #1 issue)

**Broken Access Control** is consistently OWASP's top web vulnerability — at #1 in the 2021 list and still at #1 in 2025. It's also the bug class hardest to find with pattern matching, because authorization is correct or incorrect based on **business rules**, not code shape.

If a change touches user-scoped resources, this is the first reference to read.

## The two questions

For every endpoint that touches a resource:

1. **Authentication** — do we know who is calling?
2. **Authorization** — is this caller allowed to do this thing to this resource?

A check that satisfies #1 doesn't satisfy #2. "User is logged in" doesn't mean "user can read this invoice."

## The IDOR / BOLA pattern

The single most common access-control bug: **the handler accepts a resource ID from the request and fetches the resource without checking the caller owns it.**

```
// VULNERABLE: invoice belongs to whoever asks for it
GET /invoices/:id
  invoice = db.invoices.findById(req.params.id)
  return invoice
```

The fix is **always** server-side authorization that derives the caller's identity from the session/token (not the request body):

```
// CORRECT
GET /invoices/:id
  invoice = db.invoices.findById(req.params.id)
  if (invoice.user_id !== req.user.id) throw NotFound()
  return invoice
```

Or, better, fold the check into the query:

```
invoice = db.invoices.findOne({ id: req.params.id, user_id: req.user.id })
if (!invoice) throw NotFound()
return invoice
```

Best of all, **enforce at the data layer** (row-level policies, query builder that auto-scopes) so the handler can't forget. The further from the data the check lives, the more likely some handler somewhere skips it.

### Variants to look for in code review

The change may not be on a `GET /things/:id`. The pattern shows up everywhere a resource ID is accepted:

- `PATCH /things/:id` — same check needed; missing it lets one user modify another user's thing.
- `DELETE /things/:id` — same.
- `POST /things/:parent_id/children` — does the caller own the parent?
- Body fields that reference other resources: `{ "report_id": "..." }`, `{ "team_id": "..." }`. Each reference needs an ownership check.
- Nested IDs in JSON: `{ "items": [{ "product_id": "...", "warehouse_id": "..." }] }`. Each ID is a potential IDOR.
- IDs in query strings: `?folder_id=...`, `?org_id=...`.
- IDs in WebSocket / subscription messages: `subscribe { channel: "order:..." }`.
- IDs in GraphQL arguments and nested fields.
- IDs in URL fragments to file downloads (signed URLs that don't expire / aren't scoped).

If you find one IDOR, **search for the pattern** across the codebase. They cluster: a developer who didn't enforce ownership in one handler probably didn't in three more.

## Where checks live

Ranked by reliability:

1. **At the data layer** (RLS policies in Postgres, query auto-scoping). The handler **cannot** forget because the database refuses. Strongest by far.
2. **In a single shared data-access layer** that all handlers go through. Forgetting it is harder, but not impossible.
3. **In shared middleware** for whole route groups. Good for blanket auth ("all routes under `/admin` need admin role"), weaker for per-resource ownership.
4. **In the handler, by hand.** The default-and-most-broken pattern. If you see this and it's the only check, expect to find missed ones nearby.

In code review:
- Trace the call chain. If middleware or the data layer enforces the check, **don't false-positive the handler** for "missing check."
- If the check is in the handler only, look at the handler next to it. Does it have the same check? Variant analysis is your friend.

## Server-derived identity

The caller's identity must come from the server-side session/token, not from the request:

- **Bad**: `req.body.user_id`, `X-User-Id` header trusted directly, `?user=` query param.
- **Good**: `req.user.id` populated by auth middleware after verifying a session/token.

If you see code reading `user_id` from a request body or header without further verification, that's a finding.

## Multi-tenancy

If the system has tenants/orgs/workspaces, **every user-scoped query** filters on the tenant in addition to the user/owner. Cross-tenant leaks are catastrophic and invisible to single-tenant tests.

Look for:
- A query that filters on `user_id` but not `tenant_id`. (Did the user switch tenants? Are they accessing pre-switch data?)
- A shared cache keyed only by user. (Cache poisoning across tenants.)
- A list endpoint that doesn't scope to tenant. (Probably the easiest cross-tenant leak.)

## Roles and permissions

If the codebase has roles:

- **Where is the role authoritative?** A claim in a JWT? A column in the DB? Pick one.
- **Are role checks consistent?** Same check, same place, same shape across endpoints. Inconsistency is bug breeding ground.
- **Is the role re-checked on every request?** A token issued yesterday with `role: admin` is meaningless if the user was demoted today. Check current state.
- **Are there admin endpoints not protected by the admin check?** Easy to forget on internal-only paths that get exposed later.

## Privilege escalation patterns

- **Mass assignment**: client sends `{ "role": "admin" }` in an update body, server blindly merges. Always allowlist updatable fields.
- **Self-elevation**: an endpoint that lets a user "update their profile" includes a role/permissions field. Strip server-side.
- **Indirect escalation**: an action that invites/adds someone to a group can be used to add yourself with elevated rights if the inviter's permissions aren't checked.
- **Forgotten paths**: a public registration endpoint defaults `role: user`, but an internal "create user" endpoint (used by admins) sets `role: admin` and is mistakenly reachable from the outside.

## Routing-level issues

- **A route handler exists but isn't behind the auth middleware.** Compare the route registration with the middleware mount points.
- **Wildcard routes** (`/admin/*`) catch unintended subpaths.
- **Static-file routes** that serve from a directory containing private files (or accept `..` traversal).
- **Internal-only endpoints** unintentionally exposed through a forgotten reverse-proxy rule, default service mesh, or "deploy everything publicly" config.
- **HTTP method mismatch**: route registered for `POST` only but `GET` works because the framework defaults that way; or `OPTIONS` handler that bypasses auth (CORS preflight pitfall).

## Specific high-risk operations

These deserve closer reading on every change:

- **Account merging or transferring ownership.** Misimplementation lets you take over someone else's account.
- **Password reset flows.** Token must be one-time, scoped to the requesting account, time-limited. The token must not be guessable (use a CSPRNG).
- **Invitation/share links.** Scope, expiry, and revocability matter; a forever-valid share link to private data is a leak waiting to happen.
- **Impersonation features (admin-as-user).** Audit logged, time-limited, scoped to specific tenants if relevant.
- **API tokens with broad scopes.** Per-scope, per-tenant tokens; revocable; rotated.
- **Bulk operations.** "Delete all records matching..." on a user-supplied filter must be authorized just as carefully as a single resource delete.

## What to call out, what to skip

Findings worth raising:
- A specific endpoint, with a specific resource, with a missing check, with a concrete attack path.
- A query that misses tenant filtering when its peers include it (variant analysis).
- A role check that exists in 8 of 9 admin handlers; the 9th is a finding.

Not worth raising:
- "There is no centralized authorization framework" — that's an architecture critique, not a finding. Bring it up separately if asked.
- "This handler has only one check" — fine, if the check is correct.
- "Authorization is in middleware not handler" — that's good design, not a finding.
