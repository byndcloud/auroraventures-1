# Scope & triggers

The first decision is **how much code to look at**. Scope drives noise more than any other choice. A diff review that misbehaves and complains about everything in `node_modules` is useless; a whole-repo audit pretending to be a diff review misses cross-file issues.

## Default: diff scope

Most security reviews are reviews of a change. Default to:

- The set of files touched by the current branch / PR / staged changes.
- The lines changed, plus enough surrounding context to understand them (the function they're in; the immediate caller if the change is in a helper).
- A glance at any new entrypoints (route definitions, exported handlers, scheduled tasks) — even if mostly unchanged, a new entrypoint expands attack surface.

Diff scope catches:
- New vulnerabilities introduced by the change.
- Bad habits being copied from elsewhere into new code.
- Pattern variants the change might re-introduce.

It does **not** catch:
- Pre-existing issues in untouched code.
- Issues in callers of changed code that the change didn't break but didn't fix either.
- Cross-cutting issues (e.g., a missing index on a table the change reads from).

That's fine — those need a wider scope, with the user's knowledge.

## When to widen automatically

Widen scope when the change crosses one of these lines, even if the user didn't ask:

- **A new endpoint or entry point.** Look at the auth / rate-limit / input-validation chain it sits behind.
- **A change in shared middleware** (auth, CORS, error handling). Effects ripple to every handler.
- **A change in the data layer** that affects multi-tenant scoping (queries that used to filter by `tenant_id` and no longer do).
- **A change in a security-sensitive utility** (token generator, password hasher, signed-URL builder). All call sites are now affected.
- **A change in a dependency** — particularly auth, crypto, or parsing libraries.

In these cases, do the diff review and **also** trace one or two important call chains. Tell the user you did.

## When to ask before widening

Don't silently expand to whole-repo. If the user says "review this PR" and you think the issue is upstream, ask: "I see a related concern in `src/auth/middleware.ts` that's outside the diff — should I include it?" The user can say yes; otherwise, mention it as "outside scope" in the report.

## Trigger surface — when to invoke this skill at all

These changes carry meaningful security weight; treat any of them as a trigger to run a review even without an explicit ask:

- **Authentication or session code** (login, logout, refresh, password reset, MFA, OAuth).
- **Authorization checks** (role checks, ownership checks, RLS policies, ACL changes).
- **Routing changes** that add/expose endpoints or change which middleware applies.
- **Payment, billing, money** of any kind.
- **PII handling** (storing or returning emails, names, phone numbers, addresses, IDs).
- **File uploads or downloads.** Path handling, content-type checks, signed URLs.
- **External URL fetching** by the server (SSRF).
- **Shell/exec/eval/deserialization** calls.
- **CORS, CSP, cookie, security-header** configuration.
- **Crypto, signing, token generation, randomness used for security purposes.**
- **Database migrations** that change RLS policies, drop/rename auth-relevant columns, or alter trigger logic on sensitive tables.
- **Dependency upgrades** — particularly major versions of auth, crypto, parsing, or web framework libraries.
- **CI/CD or IaC** changes that touch secrets, IAM, networking, or deployment permissions.

These are the changes where mistakes are expensive. Other changes (refactors that don't touch any of the above, UI styling, doc updates) usually don't need a security pass.

## When **not** to invoke

- The change is purely cosmetic / documentation / formatting. Skip.
- The change is in test code only. Skip (unless test code reveals a prod vulnerability — rare).
- The user is asking about a non-security topic. Don't volunteer a security review unless something obviously dangerous shows up; if it does, mention it once and continue with what they asked.

## Scope spectrum, in order of cost

| Scope | Use when | Cost | Output volume |
|-------|---------|------|---------------|
| **Single file** | User points at one file | Cheapest | Tiny |
| **Diff** | PR / branch review (default) | Cheap | Small |
| **Feature** | A defined feature touched by the change | Medium | Small–medium |
| **Module** | Periodic review of auth / billing / etc. | Medium–high | Medium |
| **Category sweep** | "Find all hardcoded secrets" / "all unparameterized SQL" across repo | Variable | Long but narrow |
| **Whole repo** | First-time audit, or post-incident | High | Long; needs splitting |

If a user asks for "the whole thing," propose splitting it: "I'll do this as five sweeps — auth, secrets, injection, misconfiguration, dependencies — separately. Otherwise the report is too long to act on."

## What the user should be told

After every review, the report opens with **one line about scope**:

> Scoped to: diff in branch `feat/x` (12 files, ~340 changed lines). Did not review unchanged code.

This is what gives the rest of the report meaning. A "no findings" report with no scope line is useless — no one knows what was actually checked.
