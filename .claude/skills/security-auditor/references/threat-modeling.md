# Threat modeling (lightweight)

Threat modeling has a reputation for being heavyweight: workshops, diagrams, multi-day exercises. None of that is required for a code review. What's required is **asking the right questions about the change in front of you**, structured enough not to miss whole categories.

The framework that fits a code review best is **STRIDE** — six questions you ask about every piece of attack surface in scope.

## STRIDE in one paragraph

For each entry point and each piece of data the change touches, ask:

- **S**poofing — can a caller pretend to be a different identity?
- **T**ampering — can data be modified in transit, at rest, or in flight?
- **R**epudiation — can someone perform an action and credibly deny it?
- **I**nformation disclosure — can someone see data they shouldn't?
- **D**enial of service — can someone make this slow or unavailable?
- **E**levation of privilege — can a low-privilege actor gain higher privileges?

Each maps to a property the system should have (authentication, integrity, non-repudiation, confidentiality, availability, authorization).

## Three preliminary questions

Before STRIDE, name the boundary in plain words:

1. **Where does input come from, and how trusted is it?**
   - Anonymous internet → fully untrusted.
   - Authenticated user → semi-trusted; their own data is fair game, others' is not.
   - Internal service → trusted, but only as much as that service's own auth.
   - Database → trusted unless your code wrote it from untrusted input earlier (second-order injection).
2. **What data does this code read, write, or expose?**
   - Other users' data? Other tenants' data? Money? Auth secrets? PII?
3. **What does the code call into?**
   - Other services? Shell? File system? Database? LLM? An external URL the user can influence?

These three questions point you at the trust boundaries the change crosses. STRIDE is then asked at each boundary.

## Applying STRIDE to the change

You don't need a six-page deliverable. For a typical PR:

> *"This adds a `POST /v1/exports` endpoint that runs a report for the authenticated user and emails them a CSV. Trust boundary: HTTP edge (untrusted) → handler (trusted) → DB (trusted) → email service (trusted with our credential)."*
>
> - **Spoofing** — endpoint requires bearer token; relies on existing auth middleware. ✓
> - **Tampering** — request body picks the report; have we validated the report ID belongs to the user? **— look here**.
> - **Repudiation** — every export should be logged with user ID + report ID for billing/auditing. **— check log line**.
> - **Information disclosure** — the CSV may contain other users' data if the report ID isn't ownership-checked. **— same as Tampering, this is the high-risk bit**.
> - **DoS** — report generation is expensive; one user could trigger many. **— rate limit?**
> - **Elevation** — admin-only reports? Are admin checks enforced? **— check.**

The STRIDE pass takes a few minutes and tells you where to read deeply.

## Common patterns by trust boundary

### Anonymous internet → application

The highest-stakes boundary. Always check:
- Authentication is enforced (or the endpoint is intentionally public).
- Rate limits exist.
- Input is validated against a schema.
- Errors don't leak internals (stack traces, framework names, DB queries).
- CORS is restrictive.

### Authenticated user → application

The most-missed boundary. The user is real, but the data they're asking for may not be theirs. Always check:
- Ownership / role check on every resource accessed by ID.
- Multi-tenant filter (`tenant_id`) on every query.
- Server-derived identity, never client-supplied (`X-User-Id` headers from clients are not authentication).

### Application → external service

When your server fetches a URL, calls an API, runs a shell command:
- Is the URL/argument user-influenceable? (SSRF, command injection.)
- Is the credential scoped tightly? (A leaked broad credential = total compromise.)
- Is the response trusted? (A compromised dependency could return malicious content.)

### Application → data store

Mostly handled by the data layer — but check:
- Queries are parameterized.
- Writes from untrusted input go through validation first.
- Transactions cover the full unit of work, not half of it.

## Identity questions specific to this codebase

A few questions to answer once and then keep in mind:

- **Where is the canonical "who is the caller" derived?** (Session middleware? JWT verification? An auth proxy?) Anything that disagrees is a bug.
- **What is the unit of multi-tenancy?** Per-user? Per-org? Per-workspace? Every user-scoped query needs to filter on it.
- **Are there roles/permissions, and where are they enforced?** Middleware? Decorator? Inline? Inconsistent enforcement is the most common authorization bug.
- **Is there a "system" or "service" identity** that bypasses auth (cron jobs, internal callers)? Where is it limited?

These don't change between PRs; once known, you reference them quickly during review.

## Output format for a quick threat model

When you write one as part of a review, keep it small:

```
## Threat surface

Entry: POST /v1/exports (auth required)
Data: rows from `reports` and `report_results` for the caller's tenant
Calls out: SES (email)

Risks worth checking:
- I/T: report_id ownership not enforced → user A could export user B's report
- DoS: no rate limit on a 30-second job
- R: no audit log entry for export action
```

This belongs at the top of the review report, especially for feature-level reviews. Diff-only reviews can skip the explicit threat model and just hit the relevant references.

## Don't try to be paranoid about everything

A threat model that lists every conceivable threat is useless. The goal is to **focus the read** — to make sure you didn't skip the category where the bug actually lives. Three or four bullet points covering the dominant risks beats a 40-item taxonomy.
