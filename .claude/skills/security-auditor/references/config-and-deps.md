# Configuration, dependencies, and infrastructure

OWASP A02:2025 — Security Misconfiguration — moved up to #2 for a reason: the most common bugs in 2025 are not subtle code mistakes, they're a `*` in an allowlist, a default that no one changed, or a dependency that hasn't been updated.

## CORS

Cross-Origin Resource Sharing decides which other origins can call your API from a browser. Misconfiguring it loosens the same-origin protection the browser otherwise gives you.

Findings to look for:

- **`Access-Control-Allow-Origin: *` on an endpoint that returns auth-scoped data.** With credentials, browsers refuse `*`; some servers respond by reflecting the `Origin` header instead — same problem.
- **Reflecting `Origin` without an allowlist.** "Allow whatever origin asked" = no CORS protection at all.
- **`Access-Control-Allow-Credentials: true` paired with a lax origin policy.** Credentials enable cookie-based attacks; the origin allowlist must be tight.
- **Allowlists with broad regexes** (`/.*\.example\.com$/` matches `evil.example.com.attacker.com` if the regex isn't anchored). Pin to exact origins or use anchored, non-overlapping patterns.

The right default: explicit allowlist of a small number of origins, with credentials only when needed.

## HTTP security headers

For HTML responses, these headers reduce blast radius:

- `Content-Security-Policy` — limits where scripts/styles/connects can come from. The biggest defense-in-depth control against XSS.
- `Strict-Transport-Security` — clients refuse HTTP after first HTTPS contact.
- `X-Content-Type-Options: nosniff` — clients don't guess MIME types.
- `Referrer-Policy: strict-origin-when-cross-origin` (or stricter) — controls what URLs leak to outbound links.
- `Permissions-Policy` — limits browser capabilities (camera, geolocation, etc.) per origin.
- `X-Frame-Options` / CSP `frame-ancestors` — prevents clickjacking.

For APIs (JSON-only):
- `Content-Type: application/json` consistently set, with `X-Content-Type-Options: nosniff` to prevent the browser from rendering an API response as HTML in the rare case it fetches it cross-context.

A change that ships HTML without CSP, or relaxes an existing CSP (`unsafe-inline`, `unsafe-eval`, or broad `*` directives) is worth flagging.

## Cookies

Already covered in `auth-and-sessions.md`; recap for review checklist:
- `HttpOnly` on session cookies.
- `Secure` in any non-localhost environment.
- `SameSite=Lax` minimum; `Strict` for high-value flows.
- Distinct names for distinct purposes (don't reuse one cookie for both session and CSRF token).

## CSRF

Server-side state-changing endpoints reachable by a browser need CSRF protection.

- If the app is **cookie-authenticated**: anti-CSRF tokens (synchronizer pattern), or rely on `SameSite=Strict|Lax` cookies — but understand the gaps (Lax allows top-level GET, which shouldn't change state anyway).
- If the app is **bearer-token-authenticated** (token sent as `Authorization` header): CSRF is structurally not possible in the cookie sense, because the browser doesn't auto-send the bearer token. Don't add CSRF tokens — they're noise.
- Mixed schemes (some endpoints cookie, some bearer) are confusing; identify which is which.

`GET` should never change state. If you see a `GET /things/:id/delete` or any state mutation on `GET`, that's a bug regardless of CSRF — and CSRF makes it exploitable.

## Framework defaults

Frameworks ship with security-relevant defaults that vary in safety:

- **Debug / verbose error pages** must be off in any non-dev environment. Check the env-conditional that controls this.
- **Default admin endpoints** (`/admin`, `/console`, `/swagger`) shouldn't be reachable from production without auth.
- **Default credentials** in any image or service config. (Database with `postgres:postgres`, admin with `admin/admin`.) Critical findings if found.
- **TLS / cipher suite defaults** — usually fine on modern frameworks; check explicit downgrades.
- **Cookie defaults** — some frameworks default to weaker `SameSite` policies. Check for explicit setup.
- **Session secret** — generated, not the placeholder from the framework's getting-started guide.

## Dependencies

Vulnerable dependencies are an ever-renewing surface. The questions:

- **Is there a lockfile**, and is it committed? Otherwise builds aren't reproducible and dependency advisories don't apply to a specific version.
- **Is there an automated scanner** (Dependabot, Snyk, GitHub Advanced Security, OSV-scanner, npm audit, pip-audit, etc.) running in CI? If not, it's a process gap.
- **Are advisories triaged**, or do they pile up? An advisory open for a year is a finding even if not directly exploitable today.
- **Is there a dependency update cadence** that doesn't wait for CVEs? Patching is faster than monitoring for exploitation.

In a code review, look for:
- **Newly added dependencies** in the diff — are they reputable, maintained, the right level (a fully-fledged framework for what should be 50 lines)?
- **Pinned-too-loose ranges** (`"lodash": "^3.0.0"`) for security-critical libraries — pin tighter or use a lockfile.
- **Dependencies on git URLs / tarballs** without checksums — supply-chain risk.
- **Postinstall scripts in newly added packages** — a postinstall script runs at install time on every developer machine and CI runner.

## Infrastructure as Code

If the change touches IaC (Terraform, CloudFormation, Pulumi, k8s manifests, Docker Compose):

- **Public S3 buckets / open storage permissions.** A bucket with public-read on user data is a leak.
- **Wide IAM policies.** `"Action": "*"` or `"Resource": "*"` are nearly always wrong outside specific bootstrap roles.
- **Open security groups / firewall rules** (`0.0.0.0/0` on ports other than 80/443).
- **Default VPC / no network segmentation.**
- **Secrets in plaintext in IaC files.** Use the platform's secret references.
- **Containers running as root**, with `privileged: true`, with full Docker socket access, or with no resource limits.
- **Egress unrestricted.** Especially relevant for SSRF defense — egress firewall is the strongest control.
- **TLS termination details.** Self-signed certs in prod; old TLS versions allowed.

## CI/CD

The build pipeline is itself a target:

- **Secrets accessible in PRs from forks.** GitHub Actions: `pull_request_target` + checking out the PR's code is a footgun pattern that leaks secrets to external contributors.
- **Workflows triggered by `pull_request` running with elevated permissions.** Default to read-only; opt into write where needed.
- **Action references pinned to a SHA**, not a moving tag (`@v3` follows whatever `v3` points to today; `@abc123def` is immutable).
- **Self-hosted runners on shared infra** that run untrusted PRs.
- **Cache poisoning** between branches with different trust levels.
- **Artifact signing** — built artifacts ought to be signed if anyone downstream consumes them.

## Logging / monitoring as a security control

Beyond not leaking via logs (`secrets-and-data.md`), logs are *how you know about an incident*.

For high-risk operations, audit logging should exist:
- Authentication events (success, failure).
- Permission changes (role assignments, ACL edits).
- Sensitive data exports (user-data export, admin views of others' data).
- Configuration changes (feature flags affecting security, IAM edits).

If a feature touches one of these and has no audit log, that's a finding (it's the "R" in STRIDE — repudiation).

## Time and randomness

Cryptographic operations need cryptographic primitives:

- **`Math.random()` / `random.random()` / `rand()`** for security purposes (token generation, nonces, salts). Use the CSPRNG: `crypto.randomBytes`, `secrets.token_bytes`, `SecureRandom`, `os.urandom`.
- **Time-of-check-to-time-of-use** races. Generally hard to spot in review; flag if there's a "check then act" pattern on a security-relevant resource without a transaction or lock.

## Environment and configuration files

- `.env`, `.env.production`, secrets files **must be gitignored**. A real `.env` in the repo is a finding even if the values look like placeholders.
- `.env.example` (committed, no values) is good practice.
- Configuration that varies by environment must have a default that's safe-by-default (e.g., debug off, CORS strict, errors generic). Don't rely on every env config explicitly setting safety.

## What to call out, what to skip

Worth raising:
- A specific CORS policy that reflects `Origin` or allows `*` with credentials.
- A specific HTTP route that lacks an applicable security header on HTML responses.
- A specific dependency with a known CVE applicable to how it's used.
- A specific IaC resource with overly broad permissions.
- A specific use of `Math.random()` for a security purpose.
- A `.env` file with real-looking values committed.

Not worth raising:
- "Header X is not set" if the response is JSON and the header doesn't apply.
- "Dependency X has a CVE" if the affected code path isn't reached.
- "There's no automated dependency scanner" — process critique, not a code finding (mention separately).
- "Cookie is not `Secure`" in dev config — check prod config.
