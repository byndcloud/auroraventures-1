# Reporting: severity, format, false-positive discipline

A security review is read by humans who decide what to do next. The report's quality is what makes the review useful or noise.

## What every finding contains

```
### [SEVERITY] Title — file.ext:line(s)

**Where**:  src/api/orders.ts:42–58 (handler `getOrder`)

**What**:  The handler returns an order by ID without verifying the
caller owns it.

**Attack**:
1. Attacker logs in as user A and notes any of their orders' IDs
   (sequential integers, easy to enumerate).
2. Calls GET /orders/{another_id} with their session.
3. Receives the other user's order including line items, billing
   address, and total.

**Fix**:
Add an ownership predicate to the query (or apply RLS at the data
layer). The check belongs in the data access function, not the
handler — see `src/data/orders.ts:findOne`.

```diff
- const order = await db.orders.findById(req.params.id)
+ const order = await db.orders.findOne({
+   id: req.params.id,
+   user_id: req.user.id,
+ })
  if (!order) throw new NotFound()
```

**Confidence**: high
**Refs**: OWASP A01:2025; same pattern in 3 other handlers (see "Variants").
```

The pieces:

- **Severity** — see scale below.
- **Where** — file path and line range. One location, not a vague gesture.
- **What** — one sentence, no jargon. A reader who isn't a security person should understand.
- **Attack** — concrete steps from the attacker's POV. If you can't write this, the finding isn't ready.
- **Fix** — the smallest change that addresses the root cause. A diff if it's small enough.
- **Confidence** — high / medium / low. (See below.)
- **Refs** — OWASP / CWE / variants found elsewhere — optional but useful.

## Severity scale

Severity reflects **exploitability × blast radius**, not pattern presence.

### Critical

Pre-auth or low-effort post-auth path to one of:
- Account takeover at scale.
- Mass data exfiltration.
- Remote code execution.
- Authentication bypass.
- Production secret exposure (committed live credential).

A real Critical needs urgent response: fix or rollback before merge; rotate any compromised credentials.

### High

A specific user can be compromised, or a specific tenant's data leaks, given:
- A logged-in attacker.
- Knowledge or guess of an ID.
- A relatively common precondition.

IDOR with sequential IDs, stored XSS in user-visible content, missing CSRF on a sensitive state change, password reset token weakness — these are typically High.

### Medium

Real bug, harder to exploit:
- Requires unusual preconditions.
- Limited impact (information disclosure of low-value internals, DoS bounded by rate limit).
- Or a defense-in-depth control that's missing where another control covers it (CSP missing on a route that's already JSON-only, etc.).

### Low

Hardening opportunities, smell-level concerns:
- Slightly weaker than ideal config that isn't directly exploitable.
- Verbose-but-not-sensitive error message.
- Code that's safe today but invites a future regression (e.g., a query helper that supports both parameterized and concatenated forms — close the unsafe form).

### Info

Observations that aren't findings: design notes, suggestions for follow-up, things the user might want to know but that don't require action this PR.

## Confidence

A separate axis from severity. A high-severity, low-confidence finding is one you raise but flag — "I think this is exploitable, please confirm; if not, drop it."

- **High** — verified by reading the call chain end-to-end; you saw the attack path.
- **Medium** — pattern matches a known unsafe shape; haven't traced every caller; likely real.
- **Low** — looks suspicious; couldn't confirm without running the code or asking the user. State the open question.

Don't pretend confidence you don't have. Inflated confidence is how reviewers learn to ignore the report.

## False positive filter

Apply before writing the report. Common categories to drop or downgrade to **Info** rather than report:

- **Test code findings.** Issues in test fixtures and mocks aren't findings unless the test file is part of production deploy or proves a real prod bug.
- **Already-mitigated paths.** Auth middleware enforces the check upstream of the handler — handler doesn't need its own check; don't flag.
- **Unreachable code.** Branches not called from anywhere relevant.
- **Trivial DoS** on authenticated, rate-limited endpoints — usually not a finding.
- **Generic input validation without proven impact.** "This input isn't length-capped" without a downstream consequence is hardening, not a vulnerability.
- **Open redirect on a non-auth-touching surface.** Often Info-level.
- **Pure pattern hits** without semantic check — `Math.random()` in a non-security context, `eval` of a constant, `dangerouslySetInnerHTML` of a hardcoded string.
- **Theoretical timing attacks** on non-secret comparisons — usually Info.
- **Memory/CPU exhaustion concerns** unless trivial-cost-to-trigger and high-impact.

If you suppressed a class of finding, **say so** in the report's "Considered and excluded" section. Transparency about what you skipped is what gives the rest of the report credibility.

## Variant analysis: bonus round

When you find a real bug, search for the same pattern across the codebase. The same developer with the same blind spot probably wrote it three times.

A finding that says "and 4 other handlers have the same shape" is much more valuable than 5 separate findings, and tells the reviewer they're fixing a class of bug, not playing whack-a-mole.

## Report structure

```
# Security review — <scope description>

Scoped to: <one line — branch / files / lines reviewed>
Did not review: <explicit out-of-scope>
Threat surface (brief): <2-4 lines if useful>

## Findings

### Critical
<each as above>

### High
<each as above>

### Medium
<each, more concise>

### Low / Info
- file:line — short description (no narrative needed)
- file:line — ...

## Considered and excluded
- pattern X in file:line: <one-line reason — e.g., "auth enforced in middleware">
- pattern Y in file:line: <one-line reason>

## Suggested follow-ups (out of scope)
- <process / architecture observations the user can act on later>
```

If there are no Critical or High findings, **say so plainly**:

> No Critical or High findings in this scope. Three Medium findings related to logging hygiene are below.

Don't manufacture severity to justify the review.

## Length discipline

A diff review should produce a report you can act on in a sitting. Targets:
- 0–3 high-severity findings is normal for a PR.
- More than 5 high-severity findings on a single PR usually means the PR shouldn't merge yet — flag the volume itself as a signal.
- 50-finding reports are unread reports. If you find 50 things, group them and report the *class* of bug, not every instance.

## Language

- **Plain.** Security jargon makes findings inaccessible. "IDOR" is fine; "broken object level authorization" with no explanation isn't.
- **Specific.** Names of files, names of functions, names of values. "There's a problem with auth" is not a finding.
- **Actionable.** Every finding ends with what to do. Even Info-level entries say what the reader might consider.
- **Honest about limits.** "I didn't fully trace this; please verify" is fine and earns trust. Pretending to certainty that doesn't exist erodes it.

## Handling secrets discovered in the review

If you find a real-looking live credential:

1. **Don't include the credential value in the report.** Reference the file:line and the credential type.
2. **Mark Critical**, regardless of other context.
3. **Note that history rewriting alone isn't enough** — assume it's already public; rotate immediately.
4. **Suggest adding a pre-commit secret scanner** so the next attempt is caught.

## What this report is not

- It is not a substitute for human security review on systems handling money, identity, or regulated data.
- It is not a penetration test — no inputs were sent to a running system.
- It does not cover runtime behavior, infrastructure not visible in the repo, or third-party integrations beyond their interface in this code.

State this once at the bottom if relevant. Don't restate it in every section.
