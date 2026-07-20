---
name: security-auditor
description: Audit application code for security issues — leaks, bad habits, auth/authorization holes, routing/IDOR, injection, misconfiguration, exposed secrets, and design choices that will become incidents later. Use this skill when reviewing a pull request, a feature change, or a whole module for security; when the user asks "is this safe", "any security issues", "check for leaks/secrets", "audit auth/permissions", "is this exposed", "before we ship this"; or when working on anything that touches authentication, authorization, payments, PII, file uploads, or external input. Defaults to a tight diff-scoped review with strict false-positive discipline; widens to feature- or repo-level on request.
---

# Security Auditor

Use this skill to find security problems **that matter**, with **low false-positive rate**. The default failure mode of security tooling is screaming about every theoretical risk and being ignored. The default failure mode of *not* having security tooling is shipping the bug that becomes the breach. This skill aims for the narrow path: real findings, ranked by impact, with concrete fixes.

## Core principles

1. **Real impact over theoretical risk.** Every finding names a concrete attack: "User A can read User B's invoices via `/invoices/:id`." If you can't sketch the attack, the finding isn't ready.
2. **Scope drives noise.** A diff review against changed lines should produce a handful of findings, not a hundred. A whole-repo audit is a different exercise — be explicit about which one.
3. **Severity reflects exploitability, not pattern presence.** A `Math.random()` in test code is not a CVSS 9.
4. **Remediation is part of the finding.** A finding without a fix is a complaint.
5. **Don't lecture about defense in depth that's already there.** If middleware enforces auth and the handler also has a check, don't flag the handler for a "missing check" — read the call chain.

## When to invoke

Default scope: **the current change** (PR diff, branch diff, staged changes). Widen on request.

Trigger on:

- "Security review" / "security check" / "audit" / "is this safe to merge"
- "Any security issues with [this PR / this feature / this file]"
- "Check for leaks / secrets / exposed credentials"
- "Audit auth / permissions / access control"
- "Is [feature] exposed / can users access each other's data"
- "Before we ship / before we deploy"
- A change touches: auth, authorization, payments, PII, file upload/download, file paths, raw HTML/SQL, external URLs the server fetches, deserialization, file system access, shell/exec calls, environment variables, IAM/permissions config.

If the user said "review" without specifying *which* review, pick scope from the scale of the change and confirm: "Reviewing the diff in this branch — say if you want a wider sweep."

See `references/scope-and-triggers.md` for the full decision matrix.

## Flow

```
1. Define scope         ──▶  2. Cheap pre-pass (script + grep)
                                            │
                                            ▼
                          3. Threat-model the change (STRIDE, brief)
                                            │
                                            ▼
                              4. Read code along risk axes
                                            │
                                            ▼
                       5. Build candidate findings (with attack story)
                                            │
                                            ▼
              6. Filter false positives  ──▶  7. Rank & report
```

## Phase 1 — Define scope

State the scope explicitly before reading anything:

- **Diff-only** (default): the lines changed in this PR/branch + their immediate context. False-positive risk is low; coverage is bounded by what changed.
- **Feature-level**: all files implementing a named feature, including untouched callers. Use when the change adds an entrypoint or significantly alters a flow.
- **Module / subsystem**: a defined boundary (auth, billing, file upload, public API). Use for periodic audits of high-risk modules.
- **Whole-repo audit**: rare, slow, noisy. Only on request, and split by category (do "secrets across repo" as one pass, "access control across repo" as another) — never one giant pass.

Tell the user what you scoped and what you didn't. If they wanted broader, they'll say so.

## Phase 2 — Cheap pre-pass

Run `scripts/triage.sh` at the chosen scope. It's a zero-LLM grep pass for obvious smells: hardcoded credential shapes, dangerous functions, env files committed, security-flagged TODOs. Output is a list of locations to look at — **not findings**. Every hit must be confirmed by reading code.

This pass is cheap and catches the dumbest issues fast. Anything it finds is high-prior to investigate.

## Phase 3 — Threat-model the change

Read `references/threat-modeling.md`.

For the scope, run a quick STRIDE pass — six questions about each piece:

- **S**poofing — can someone pretend to be someone else?
- **T**ampering — can data be modified by someone who shouldn't?
- **R**epudiation — can an action be done without an audit trail?
- **I**nformation disclosure — can someone see what they shouldn't?
- **D**enial of service — can input crash or hang the system? (Usually low priority unless trivial.)
- **E**levation of privilege — can a user gain capabilities they don't have?

You don't need a 5-page document. A paragraph naming the entry points, the data they touch, and the trust boundaries crossed is enough to direct the read.

## Phase 4 — Read along risk axes

Pull the references that match the change. Don't pull all of them.

| Concern | Reference |
|---------|-----------|
| Who can do what to which row? Routing, IDOR, ownership checks. | `references/access-control.md` |
| Hardcoded secrets, leaking PII in logs, exposing internals in errors. | `references/secrets-and-data.md` |
| SQL/command/template injection, XSS, SSRF, unsafe deserialization. | `references/injection-and-input.md` |
| Login, sessions, JWT, MFA, password reset, account takeover. | `references/auth-and-sessions.md` |
| CORS, headers, cookies, framework defaults, vulnerable deps, CI/IaC. | `references/config-and-deps.md` |
| Prompt injection (direct + indirect), tool-invocation abuse, system prompt leakage, output validation. Anything touching LLM calls, prompt templates, agents, or RAG. | `references/ai-llm-security.md` |
| Severity, finding format, remediation language, FP filter. | `references/reporting.md` |

The single most common high-impact issue is **broken access control** (OWASP A01 every year). If the change touches user-scoped resources, read `access-control.md` first.

## Phase 5 — Build candidate findings

Each candidate has:

- **Where** — file path + line range.
- **What** — the unsafe pattern, in one sentence.
- **Attack** — concrete steps an attacker takes. If you can't write this, downgrade to "smell" and don't report it as a finding.
- **Severity** — see `reporting.md`. Tied to exploitability and blast radius, not pattern.
- **Fix** — minimal change that addresses it.
- **Confidence** — high / medium / low. Low means "this looks suspicious but I couldn't confirm exploitability without running it."

## Phase 6 — Filter false positives

This is where security review earns trust or loses it. Read `references/reporting.md`. The headline filter:

- **Test code** — issues in test fixtures and mocks are not findings unless the test itself is shipped or proves a real bug in prod code.
- **Already mitigated upstream** — if a route is gated by middleware that you traced through, don't flag the handler for "missing auth check."
- **No reachable input** — code is technically dangerous but only callable from internal trusted contexts.
- **Dead code** — branches that aren't hit by any caller. Mention as cleanup, don't flag as security.
- **Theoretical without exploit path** — `Math.random()` for a non-security purpose is not a CVE.
- **DoS via expensive operations on authenticated endpoints** — usually not a finding unless trivial-cost-to-trigger and high-impact.

Be specific about what you excluded and why — that's how a reviewer trusts what's left.

## Phase 7 — Rank & report

Read `references/reporting.md`.

Output is a short, ranked report:

- **Critical / High** at the top. Each gets full attack story + fix.
- **Medium** below. Concise.
- **Low / Info** as a bullet list — no narrative.
- **Considered and excluded** at the bottom — patterns that looked suspicious but checked out, with one-line reasons.

If there are no high-severity findings, say so plainly. Don't invent severity to justify the review.

## Anti-patterns to refuse

- **Pattern matching without semantic check.** "Code uses `eval`" is not a finding without confirming the input is attacker-controlled.
- **Severity inflation.** Calling everything Critical destroys the prioritization. If everything is critical, nothing is.
- **Generic OWASP recitation.** "Beware of SQL injection" is not a code review. Find a specific line, or move on.
- **Phantom findings.** Don't report what you couldn't confirm. Confidence: low + a question to the user is fine; fabricated specifics are not.
- **Reporting without remediation.** If you can't suggest a fix, you don't understand the issue well enough yet.
- **Auditing prod secrets you find.** If you discover a real, live credential in code, **stop**, surface it to the user, and recommend rotation — don't include the value in any output.
- **Treating this skill as a substitute for human security review** on systems handling money, identity, or regulated data. It's a force multiplier, not a replacement.
