# Secrets, leaks, and sensitive data

This reference covers two adjacent problems:

1. **Secrets in code** — credentials, tokens, keys committed to the repo.
2. **Sensitive data leakage** — PII or internals exposed in logs, errors, responses, URLs.

Both are common, both are usually preventable, and both can be invisible to non-security review.

## Secrets in code

### What counts

Anything that grants access if exfiltrated:
- API keys / access tokens (cloud providers, third parties).
- Database passwords / connection strings with credentials.
- Private keys (RSA, SSH, JWT signing keys).
- OAuth client secrets.
- Webhook signing secrets.
- Encryption keys.
- Service account credentials (JSON files for cloud providers).

### Recognizing them

High-confidence shapes (run as part of `triage.sh`'s pre-pass):
- AWS access keys: `AKIA[0-9A-Z]{16}`.
- AWS secret keys: 40-char base64-ish.
- GitHub tokens: `ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_` + ~36 chars.
- Stripe live keys: `sk_live_`.
- Slack tokens: `xox[baprs]-`.
- JWT shape: three base64-url segments separated by `.`, when the middle segment decodes to JSON.
- Private key blocks: `-----BEGIN ... PRIVATE KEY-----`.

Lower-confidence smells worth a closer look:
- Variables named `password`, `secret`, `key`, `token`, `auth` with **string literals** assigned.
- Long high-entropy string literals in source.
- `.env`, `.env.production`, `.env.local` checked into the repo.
- Config files with credentials (`config.yml`, `application.properties`).

### What to do when you find one

1. **Confirm** it's a real secret, not a placeholder (`xxx-replace-me`, `your-key-here`, fake-but-real-looking).
2. **Don't include the value in the report.** Reference the file:line, describe the type ("AWS access key shape"), recommend rotation. Including the secret in a tool output spreads it further.
3. **Treat as urgent.** A real committed secret has likely been mirrored, indexed, or scraped. The fix is **rotate**, then remove from history (best-effort), not "delete the line." If the secret is in git history, it's already public.
4. **Check the rest of the file and adjacent files** for more.

### The fix shape

- Move the value out of source. Read from environment variables or a secret manager.
- Provide a `.env.example` (no values) so future devs know what to set.
- Add the real `.env` to `.gitignore`.
- Add a pre-commit secret scanner (gitleaks, trufflehog, the platform's built-in scanner) to catch the next attempt.

## Sensitive data in logs

Logs are convenient and often forgotten. They drift to bigger and dumber audiences than you expect — error trackers, log aggregators, screenshots in tickets, CI artifacts.

### What not to log

Never log:
- Passwords, even hashed (the fact that the hash exists for a given user reveals account existence in some flows; and hashes are still high-value targets).
- Auth tokens (sessions, JWTs, API keys, refresh tokens).
- Full credit card numbers / CVVs / track data.
- Full social security numbers, government ID numbers, passport numbers.
- Authorization headers verbatim. (`Authorization: Bearer ...`).
- Cookies that include session IDs.
- Decrypted contents of messages in an E2E system.
- Full request/response bodies on auth endpoints.

Be deliberate about logging:
- Email addresses (PII; affects retention, GDPR/CCPA).
- IP addresses (PII in many jurisdictions).
- Names, phone numbers, physical addresses.
- Internal IDs that link to PII (sometimes acceptable; document).

### Patterns that leak unintentionally

- **Logging entire request objects.** `logger.info({ req })` includes headers, cookies, body. Use a serializer that allowlists fields.
- **Logging entire response objects.** Includes whatever the response would have leaked (covered below).
- **Stack traces from errors thrown with sensitive context.** An error message like `"Failed to find user with token abc123def..."` leaks the token to the log.
- **Third-party error reporters** (Sentry, Datadog) capturing exception messages and request context. Configure scrubbing per the vendor's docs.
- **Debug-level logs left enabled in production.** Often the highest-volume leakers.
- **Audit logs of authorization decisions** that include the data being authorized over (if the data is sensitive, the audit log is now sensitive).

### The fix shape

- Centralize logging through a logger that **redacts** sensitive fields by name (`password`, `token`, `authorization`, `cookie`, `card_number`, etc.) before serializing.
- Define a **safe-to-log subset** of common shapes (`req` becomes `{method, route, status, request_id, user_id}`).
- Reject "log everything to debug it" as a fix; debug to a transient, not-shipped target.

## Sensitive data in error responses

The same data that shouldn't appear in logs also shouldn't bounce back to the client in error messages.

### Common leak patterns

- **Stack traces in production responses.** Reveals framework, version, file paths. Shouldn't be enabled in any non-dev environment.
- **Database error strings.** `duplicate key value violates unique constraint "users_email_key"` confirms an email exists in the system. Use generic error messages on auth/registration boundaries.
- **ORM / query builder errors** that reveal table and column names.
- **Internal exception messages** propagated to the user verbatim. `"Failed to call internal service https://users.svc.internal/v2/lookup"` leaks topology.
- **Verbose validation errors** that reveal which field exists vs. doesn't, which value is the conflict.

### The fix shape

- One generic error shape returned to the client (see backend-architect/api-design.md): `{error: {code, message, request_id}}`.
- The detailed error logs server-side under that `request_id`. Client gets a request ID for support; attacker gets nothing actionable.
- Disable framework's "verbose error page" in any non-dev environment.

## Sensitive data in URLs

URLs end up in places you can't reach: browser history, server access logs, CDN logs, referer headers sent to third parties, link previews, screenshots.

Don't put in URLs:
- Auth tokens, password reset tokens, magic-link tokens (use one-time tokens with short TTL, redirect to a session as soon as possible).
- API keys.
- PII that should be in a body.

The fix: tokens go in `Authorization` headers or short-lived cookies; reset/magic links use single-use tokens that are exchanged for a session immediately.

## Sensitive data in client-visible places

The frontend is not a trust boundary — anything sent to it is public. Don't:
- Put admin-only fields in a response that goes to non-admin users.
- Embed API keys in JavaScript bundles. (Anyone running the app sees them.)
- Rely on hidden form fields for trust ("don't show the price field, but trust whatever value the form posts back").

The frontend can hide UI; only the server can enforce trust.

## PII handling rules of thumb

If the change deals with PII:

- **Minimize collection.** Don't collect what you don't need.
- **Encrypt at rest** for fields with regulatory requirements (depends on jurisdiction; ask if unsure).
- **Document retention.** How long is this PII kept? Who can delete it?
- **Right to erasure.** If GDPR/CCPA applies, deletion paths must actually delete (or anonymize beyond recovery), including in derived stores (caches, search indexes, analytics, backups within retention windows).
- **Access logs.** Reads of sensitive data should themselves be auditable when the impact warrants.

## What to call out, what to skip

Worth raising:
- Hardcoded credential, with file:line.
- A log line that includes a token / password / full PII.
- An error response that returns a stack trace.
- A query string that carries an auth token.
- A response that returns more fields than the caller's role should see.

Not worth raising as a security finding:
- "Logs include a user ID." That's normal in audit-grade logging; mention only if context makes it sensitive.
- "Email addresses are stored unencrypted." Almost universally true and not a finding without specific regulatory context.
- "Generic, redacted error messages exist." Working as intended.
