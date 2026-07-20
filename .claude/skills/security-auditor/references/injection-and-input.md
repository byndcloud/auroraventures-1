# Injection & input handling

Injection is data being interpreted as code (or as the wrong kind of data) because the boundary between them was lost. The fix is the same in every flavor: **don't build the dangerous thing by string concatenation; use the API that keeps the boundary**.

## SQL injection

**Always parameterize.** Every database query that incorporates a value from outside the function should use placeholders, not string interpolation.

Vulnerable:
```
db.query(`SELECT * FROM users WHERE email = '${email}'`)
db.query("SELECT * FROM users WHERE email = '" + email + "'")
db.exec(f"DELETE FROM sessions WHERE token = '{token}'")
```

Safe:
```
db.query("SELECT * FROM users WHERE email = $1", [email])
db.query("SELECT * FROM users WHERE email = ?", [email])
```

Where to look:
- Anywhere `query`, `exec`, `raw`, `unsafeRaw` is called with a template literal or a `+`-built string.
- ORM "raw" escape hatches: `Model.findBySql(...)`, `db.$queryRawUnsafe`, `manager.query(rawSql)`.
- Dynamic ORDER BY / LIMIT / column names — these can't be parameterized in most drivers, so they need allowlist validation. (`?sort=name` → check `name` is in a hardcoded set of valid columns before using.)
- `LIKE` patterns — escape `%` and `_` if they're user-supplied and you don't want them to be wildcards.

Non-SQL stores have analogous issues:
- **MongoDB**: operator injection. `find({ username: req.body.user })` — if the body is `{"$ne": null}`, the query matches everything.
- **Redis Lua scripts**: don't concatenate user input.
- **GraphQL**: ensure resolvers run with proper auth context, not just whatever the query asks for.

## Command injection

If the server runs a shell, **don't pass user input to it as part of a command string**.

Vulnerable:
```
exec(`convert ${userPath} -resize 200 ${outPath}`)
os.system(f"ffprobe {filename}")
subprocess.call("git clone " + repo + " /tmp/work", shell=True)
```

Safe:
```
execFile("convert", [userPath, "-resize", "200", outPath])
subprocess.run(["ffprobe", filename], shell=False)
```

Use the array form. The shell is never invoked, so shell metacharacters in the input are not interpreted.

Where to look:
- Calls to `exec`, `execSync`, `system`, `Runtime.exec`, `subprocess.run/call/Popen` with `shell=True`, `os.system`, backticks (in shell scripts).
- Wrappers like `git`, `ffmpeg`, `imagemagick`, `pandoc` invoked with user-supplied paths or arguments.
- "Just" passing a filename — filenames can contain spaces, `$()`, `;`, `&&`, etc.

Even in array form, watch for arguments that themselves can be interpreted dangerously by the wrapped tool (e.g., `--config=/etc/passwd` to a tool that reads files).

## Path traversal

User input that becomes a file path can escape the intended directory.

Vulnerable:
```
fs.readFile(`/var/uploads/${req.params.filename}`)   // filename could be "../../etc/passwd"
sendFile(path.join("/uploads", req.query.path))       // path could be "/etc/shadow"
```

Safe:
```
const safe = path.basename(req.params.filename)       // strips path components
const full = path.join("/var/uploads", safe)
if (!full.startsWith("/var/uploads/")) throw new Error()
```

Or, better, **don't take filenames from the user**. Use server-generated keys (UUIDs) and look up the original name in the database.

Where to look:
- `fs.readFile`, `fs.writeFile`, `open(...)`, `sendFile`, `serveStatic` with user input as part of the path.
- Archive extraction (`zip`, `tar`) — the entries inside an archive can contain `..`. Use a library that validates paths before extracting (`zip-slip`).
- File downloads where the URL contains the filename verbatim.

## Cross-site scripting (XSS)

User input being rendered into HTML (or attribute, or URL, or JS context) without proper encoding.

Three contexts, three encodings:
- **HTML body**: HTML-escape. (`<` → `&lt;`)
- **HTML attribute**: attribute-escape (also handles `"` and unicode tricks).
- **JavaScript context**: JS-escape, or — better — don't render data into a `<script>` tag, deliver it via a JSON endpoint or a `data-` attribute the JS reads.
- **URL context** (e.g., `<a href="...">`): URL-encode and validate the scheme (no `javascript:`).

Modern frameworks (React, Vue, Angular) escape by default — XSS arises when developers reach for the escape hatch:
- **React**: `dangerouslySetInnerHTML`.
- **Vue**: `v-html`.
- **Angular**: `[innerHTML]` with `bypassSecurityTrustHtml`.
- **Svelte**: `{@html ...}`.

Each of these turns a string into HTML. Every use is a finding unless the input is provably safe (constants, server-side-sanitized).

Server-side templating: don't disable autoescaping. If the codebase has its own templating, look for any place a value is concatenated into HTML without an explicit encode.

### Stored XSS

The dangerous form: data is saved (e.g., user profile bio, comment), then rendered later. Even if the rendering site escapes correctly, anywhere it doesn't (a different surface, an admin panel, a CSV export opened in Excel) can resurface the bug.

Sanitize on output, not input — input sanitization fights every renderer; output encoding works once per renderer.

For "rich text" features that need to allow some HTML (Markdown rendering, WYSIWYG), use a vetted sanitizer (DOMPurify, Bleach) configured with an explicit allowlist. Allowlist is required; denylist invariably misses something.

### Content Security Policy

A strong CSP is defense-in-depth — it limits the damage if XSS does occur. A change that loosens CSP (`unsafe-inline`, `unsafe-eval`, broad `*`) is worth flagging.

## SSRF (server-side request forgery)

If the server fetches a URL based on user input, an attacker can make it fetch:
- Internal services (`http://10.0.0.5/admin`, `http://localhost:6379` — Redis with no auth, etc.).
- Cloud metadata services (`http://169.254.169.254/latest/meta-data/iam/`) which can leak instance credentials.
- File URLs (`file:///etc/passwd`).

Vulnerable patterns:
- "Webhook URL" / "callback URL" / "import from URL" / "preview link" features.
- Image proxies, link previews, OG-tag fetchers.
- Server-side import / "fetch this from S3" features.

Safe patterns:
- **Allowlist** the schemes (`https` only, no `file:`, `gopher:`, `dict:`).
- **Block private IP ranges** (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.0/8`, `169.254.0.0/16`, IPv6 equivalents).
- **Resolve DNS once and pin** to the resolved IP for the request — otherwise a TOCTOU between the check and the fetch lets DNS rebind to a private IP.
- **Block redirects to private IPs.** Many libraries follow redirects by default; the first hop is public, the second is internal.
- **Egress firewall** at the network layer, when possible — the strongest defense.

If the codebase has its own URL fetcher, check for these protections at the call site or in the wrapper.

## Open redirect

Vulnerable:
```
GET /login?next=...
  // after login...
  res.redirect(req.query.next)   // next could be "https://evil.com"
```

Used in phishing — the attacker sends a link to your real domain, which redirects to theirs after login.

Safe: validate `next` is a relative path or matches an allowlist of hosts.

## Unsafe deserialization

Languages with object-graph deserializers (`pickle` in Python, `ObjectInputStream` in Java, `Marshal` in Ruby, certain `unserialize` paths in PHP, `node-serialize` in Node.js) can execute arbitrary code from a malicious payload. These are not safe for untrusted input.

Use JSON / Protobuf / a structured deserializer that doesn't reconstruct arbitrary types.

If you see `pickle.loads`, `ObjectInputStream.readObject`, `yaml.load` (Python — use `safe_load`), or `Marshal.load` reading data that came from outside the trust boundary, it's a finding.

## Server-side template injection (SSTI)

If a templating engine processes user input as a **template** (not as data), it can execute code.

Vulnerable:
```
template.render("Hello {{ user_input }}")   // input becomes part of template
```

Safe:
```
template.render("Hello {{ name }}", { name: user_input })   // input is data
```

Look for any place a template string is built from user input rather than rendering a fixed template with input as data.

## XML external entities (XXE)

XML parsers that resolve external entities can read local files or trigger SSRF when fed a malicious doc with `<!DOCTYPE ... [<!ENTITY x SYSTEM "file:///etc/passwd">]>`.

Most modern parsers default to safe; older ones (especially in Java, .NET, Python's `xml.etree.ElementTree` historically) need explicit configuration. If the codebase parses untrusted XML, confirm external entity resolution is disabled.

## Regex denial of service (ReDoS)

Catastrophic backtracking in poorly written regexes can hang the server on a small input. Common shapes: `(a+)+`, `(.*)+`, alternations with overlapping options.

Most languages now ship with linear-time regex engines or fuzz-tested optimizations, but Node.js (V8) and others still use a backtracking engine. If you see complex regexes applied to untrusted input, run them through a checker (safe-regex, redos-detector).

## Input validation as a layer

All of the above are sometimes mitigated by validation at the edge:
- Schema-validate request bodies (zod, JSON Schema, Pydantic, etc.). Reject unknown fields.
- Length-cap free-form fields aggressively. A 100MB "name" field is begging for trouble.
- Type-coerce explicitly — don't rely on dynamic-language defaults turning `"123"` into `123` ambiguously.

Validation isn't a substitute for parameterization/encoding at the sink — defense in depth: validate at the edge **and** parameterize/encode at the sink.

## What to call out, what to skip

Worth raising:
- Specific concatenation into a SQL/shell/HTML/path string from a request value.
- A `dangerouslySetInnerHTML` / `v-html` / `[innerHTML]` from non-constant input.
- A URL fetcher with no scheme/IP allowlist on user input.
- A `pickle.loads` on data from outside the trust boundary.

Not worth raising:
- Parameterized queries that look ugly but are safe.
- `dangerouslySetInnerHTML` of a hardcoded constant.
- `exec` of a hardcoded command with no user input in arguments.
- Theoretical ReDoS on a regex applied to a 1-character input.
