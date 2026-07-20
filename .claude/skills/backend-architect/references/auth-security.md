# Auth & Security

Authentication and authorization are different problems. Solve them separately.

## Authentication: who is calling

Pick one model per surface:

- **Session cookies** — first-party web apps. `HttpOnly`, `Secure`, `SameSite=Lax` (or `Strict`), short-lived, rotated on privilege change.
- **Bearer tokens (JWT or opaque)** — APIs, mobile apps, server-to-server. Sent in `Authorization: Bearer ...`.
- **API keys** — server-to-server only. Long-lived, rotatable, scoped. Never in a browser.
- **OAuth 2.0 / OIDC** — third-party identity. Don't roll your own.

### JWT specifics (when used)

- Sign with an asymmetric algorithm (`RS256`, `EdDSA`) when issuer and verifier are different services. `HS256` only when both are the same trust boundary.
- **Always verify** `iss`, `aud`, `exp`, `nbf`, signature. Pin the algorithm — never accept whatever the token's `alg` header claims (the `none` algorithm attack).
- Keep tokens short-lived (minutes to ~1 hour). Use refresh tokens for longer sessions.
- The token is a **claim**, not a fact. Re-check authorization on every request against current state — don't trust roles/permissions baked into a token from yesterday.
- Don't put PII or secrets in JWT claims. They're base64, not encrypted.

### Passwords

- Hash with `argon2id` (preferred) or `bcrypt`. Never `md5`, `sha1`, `sha256`-alone, or anything reversible.
- Minimum length, no maximum below 64. No "must contain a symbol" theater that pushes users to `Password1!`.
- Rate-limit login attempts per account **and** per IP.
- On password change, invalidate all existing sessions/tokens.

### MFA

For any account with elevated privileges or access to others' data, MFA is not optional. TOTP minimum; WebAuthn preferred.

## Authorization: what they're allowed to do

Three common patterns, in increasing power and complexity:

1. **Ownership check** — `where user_id = current_user_id`. Sufficient for most user-scoped resources.
2. **RBAC** — roles → permissions → resources. Clean for org-style apps with clear job functions.
3. **ABAC / policy engine** — attribute-based, expressed as policies (`OPA`, `Cedar`, or row-level policies in the database). Use when rules depend on resource attributes, time, location, etc.

### Push enforcement to the data layer

The further from the data the check lives, the easier it is to forget it. In a Postgres-centric system, **row-level policies** are the strongest pattern: every query is automatically scoped to the caller, and a forgotten `WHERE user_id = ?` in a handler can't leak data because the database refuses.

In a service-centric system, route every data access through a single authorized data-access layer. Handlers should not write raw queries.

### Default deny

The default policy is **deny**. Permissions are added explicitly. A new table, a new endpoint, a new role — none of them grant access until you say so.

### Multi-tenancy

If the system has tenants, **every** data-layer check includes `tenant_id`. A tenant should be cryptographically unable to read another tenant's data — not "we trust the WHERE clause."

## Secrets management

- **Never** commit secrets. Use a secret store (cloud KMS, Vault, platform-provided env vars).
- Local development uses a `.env` that is gitignored, with a committed `.env.example` showing keys (no values).
- Rotate secrets on a schedule **and** on suspected compromise. Have a rotation runbook before you need it.
- Service-to-service: short-lived credentials (workload identity, signed JWTs) over long-lived API keys when the platform supports it.

## Input handling

- **Validate** every input at the edge against a schema. Trust nothing from a client.
- **Parameterize** every database query. String-concat SQL is how SQL injection happens; the answer is always parameters or a query builder, never "I'll escape it carefully."
- **Encode on output**, contextually: HTML-escape for HTML, JSON-encode for JSON, URL-encode for URLs. Don't mix layers.
- **Don't echo** user input into errors verbatim if it could be malicious — log it server-side, return a generic message.

## CORS

- Never `Access-Control-Allow-Origin: *` on an endpoint that accepts cookies or auth headers.
- Maintain an explicit allowlist of origins. Reject by default.
- Don't reflect `Origin` back without checking.

## Rate limiting

Every public endpoint has a rate limit. At minimum:
- Per-IP for unauthenticated endpoints.
- Per-account for authenticated endpoints.
- Tighter limits on auth, password reset, and anything that sends email/SMS.

`429` with a `Retry-After` header is the right response. Don't silently drop.

## Logging & PII

- Don't log secrets, tokens, passwords, full credit card numbers, or full auth headers — even at debug level. Redact before logging.
- Be deliberate about logging PII. Where you do, document retention and deletion.
- Logs can leak. Treat them as a sensitive data store.

## OWASP Top 10 — the short list

If the design touches any of these, audit explicitly:
- Broken access control (most common; see "push to data layer" above).
- Cryptographic failures (storing what should be hashed, hashing what should be encrypted).
- Injection (SQL, command, LDAP, template).
- Insecure design (missing rate limits, missing auth on internal endpoints).
- Security misconfiguration (default credentials, verbose errors in prod).
- Vulnerable dependencies (have an update cadence; know your SBOM).
- Identification and authentication failures (session fixation, weak password recovery).
- Software and data integrity failures (unsigned updates, untrusted deserialization).
- Logging and monitoring failures (you can't respond to what you can't see).
- Server-side request forgery (validate any URL the server fetches; deny private IP ranges).
