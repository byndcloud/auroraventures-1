# File Storage

Don't store binary blobs in the relational database. Store them in object storage; store **metadata** in the database.

## The standard pattern

```
┌─────────┐    1. request upload URL    ┌─────────┐
│ Client  │ ─────────────────────────▶  │ Backend │
│         │  ◀─────────────────────────  │         │
│         │    2. signed PUT URL         └─────────┘
│         │                                   │
│         │    3. PUT directly to storage     │ 4. backend records
│         │ ──────────────────▶┌──────────┐   ▼  metadata when
│         │ ◀──────────────────│  Object  │      client confirms
│         │                    │ Storage  │      OR storage emits
└─────────┘                    └──────────┘      a webhook
```

The backend never proxies the bytes. Two reasons: (1) it doesn't have to scale CPU/bandwidth with file size, (2) it doesn't have to hold the connection for slow uploads.

## Metadata table

Every uploaded file gets a row:

```
files
├── id (uuid)
├── owner_id          -- who owns this (auth scope)
├── tenant_id         -- if multi-tenant
├── bucket            -- where it lives
├── path              -- key inside the bucket
├── content_type      -- declared on upload, verified server-side
├── size_bytes        -- declared, verified
├── checksum          -- sha256, optional but cheap insurance
├── status            -- pending | uploaded | failed | deleted
├── created_at, updated_at, deleted_at
└── (any domain links: post_id, message_id, etc.)
```

The path/key in storage is **not user-controlled**. Generate it server-side: `tenants/{tenant_id}/users/{user_id}/{uuid}.{ext}`. User-controlled keys enable path traversal and overwrite attacks.

## Signed URLs

- **Short expiry** — minutes, not hours. The URL is a bearer credential.
- **Method-scoped** — a PUT URL doesn't allow GET, and vice versa.
- **Size-bounded** — the policy caps `Content-Length`. A signed URL with no size cap is a "fill my bucket" voucher.
- **Type-restricted when possible** — pin `Content-Type` if your storage supports it.

## Validation

Don't trust the client's declared `Content-Type` or filename:

- **Verify content type server-side** — magic-byte sniffing on a small read of the object. A `.png` claiming to be `image/png` but starting with `<script` is a story.
- **Verify size** against the declared/limit value.
- **Reject dangerous types by default**: executables, HTML (XSS via served content), SVG (XSS via embedded scripts) — unless your domain genuinely needs them.
- **Strip metadata** that leaks privacy (EXIF GPS in photos) when appropriate.
- **Scan for malware** if files will be downloaded by other users. Quarantine until scan completes.

Two-phase upload protocol:
1. Client requests upload URL → row created with `status='pending'`.
2. Client uploads to storage.
3. Storage emits a webhook (or client confirms) → backend validates, sets `status='uploaded'` (or `failed`).
4. **Only `uploaded` rows are referenced** by domain logic. Pending/failed rows get cleaned up by a cron.

## Serving files

For private files: signed GET URLs, short-lived, generated per-request. Don't expose long-lived public URLs for anything user-scoped.

For public files: a CDN in front of the bucket. Cache-Control headers, immutable URLs (`/{hash}/{name}`) so updates don't fight cache.

## Deletion

- Default: **soft-delete metadata** first; a cron physically removes the object after a grace period (30 days is typical). Lets you recover from "oops".
- Hard-delete only when retention policy or law requires (right-to-erasure).
- A deleted metadata row with no orphan-cleaning cron leaks storage forever. Have the cron from day one, even if the grace period is 24h.

## Lifecycle

Use the storage provider's lifecycle rules — they're free and reliable:

- Move cold objects to cheaper storage class after N days.
- Auto-delete pending/incomplete uploads after a TTL.
- Auto-expire log/temp prefixes.

## Large files

For files over a few hundred MB:

- **Multipart / resumable uploads.** Provider-supported; the client uploads in chunks and can resume.
- **Don't checksum or scan synchronously** in the request — kick a job.
- **Stream on download.** Never load a 2GB file into memory to send it.

## Common mistakes

- Letting the client pick the storage key (path traversal).
- Trusting the client's `Content-Type` (XSS via uploaded HTML).
- Long-lived public URLs to private content (link sharing → unintended access).
- Storing the file in the database "just for now" (it's never just for now).
- No cleanup of pending uploads (storage bill grows quietly).
- Backend proxying the upload bytes (CPU, memory, slow-loris exposure).
