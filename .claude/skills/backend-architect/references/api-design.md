# API Design

The contract is the product. Design it before the implementation.

## Style

Pick one and stay consistent within a service:

- **REST over HTTP**: resource-oriented, predictable verbs, cacheable. Default for public-facing CRUD.
- **RPC** (HTTP POST + named operation): better for action-oriented surfaces ("send-invitation", "rotate-key"). Don't bend REST into RPC ("POST /users/123/actions/promote") — just call it RPC.
- **GraphQL**: only when there are many clients with genuinely different read shapes and you've accepted the operational cost (caching, N+1, depth limits).

Mixing styles in one service is a smell. Mixing across services is fine.

## Resource modeling

- Resources are **nouns**, plural: `/orders`, `/orders/{id}`, `/orders/{id}/items`.
- Don't model endpoints around UI screens. The same resource may feed many screens; the API shouldn't change when the UI does.
- Sub-resources only when the child genuinely doesn't exist outside the parent. Otherwise expose `/items?order_id=...`.
- Avoid deep nesting (`/a/{}/b/{}/c/{}/d/{}`) — two levels max in URLs.

## Verbs and status codes

| Verb | Use | Idempotent | Typical success |
|------|-----|------------|-----------------|
| `GET` | Read | Yes | `200` |
| `POST` | Create / non-idempotent action | No | `201` (created) or `200` |
| `PUT` | Full replace | Yes | `200` / `204` |
| `PATCH` | Partial update | No (unless explicitly designed) | `200` |
| `DELETE` | Remove | Yes | `204` |

Status code rules:
- `2xx` = success. `4xx` = caller's fault. `5xx` = your fault.
- `400` = malformed request. `401` = not authenticated. `403` = authenticated but not allowed. `404` = doesn't exist (or you don't want to admit it does). `409` = conflict (version mismatch, unique violation). `422` = well-formed but semantically invalid. `429` = rate limited.
- Never return `200` with `{"error": ...}` in the body. Use the right status.

## Request/response shapes

- **JSON**, snake_case or camelCase — pick one, document it, don't mix.
- Wrap collections: `{"data": [...], "next_cursor": "..."}`. Don't return a bare top-level array — you can't add metadata later without breaking clients.
- Wrap single resources only if you need siblings (`meta`, `links`); otherwise return the object directly.
- Timestamps as RFC 3339 strings (`"2026-05-05T14:32:00Z"`), not epoch seconds. UTC only.
- Money as a string or as `{amount: 1234, currency: "USD"}` where amount is the smallest unit. Never a float.

## Error shape

One shape for the entire API:

```json
{
  "error": {
    "code": "resource_not_found",
    "message": "Order ord_abc123 not found.",
    "details": { "resource_type": "order", "id": "ord_abc123" },
    "request_id": "req_..."
  }
}
```

- `code` is **stable, machine-readable, snake_case**. Clients branch on this.
- `message` is human-readable, may change.
- `request_id` is the correlation ID; clients send it back when reporting bugs.

## Pagination

- **Cursor-based** for anything that can grow. Offset/limit breaks under inserts and is slow at depth.
- Response includes `next_cursor` (and `prev_cursor` if needed). Empty cursor = end.
- Default page size sane (20–50). Hard cap (e.g., 100). Reject larger.

## Filtering, sorting

- Filter via query params: `?status=open&created_after=2026-01-01`.
- Sort via a single param: `?sort=-created_at` (leading `-` for desc).
- Don't expose ad-hoc query languages (`?filter=name:like:foo`) unless you've committed to maintaining them.

## Idempotency

For non-idempotent operations that retry (payments, sending messages):
- Accept an `Idempotency-Key` header.
- Store the key + response for a window (24h is typical).
- Same key + same payload → return the stored response.
- Same key + different payload → reject with `409`.

## Versioning

Pick one strategy, document it:
- **URL prefix**: `/v1/orders`. Coarse, simple, hard to evolve incrementally.
- **Header**: `Anthropic-Version: 2026-05-05`. Granular, harder for casual clients.

Never version individual endpoints. Version the API.

## Validation

- Validate at the edge (request handler) with a schema, not scattered `if` checks.
- Reject unknown fields by default. Forward-compatible clients shouldn't be silently dropping data.
- Validation errors return `400` or `422` with per-field details:

```json
{
  "error": {
    "code": "validation_failed",
    "message": "Request body is invalid.",
    "details": {
      "fields": {
        "email": "must be a valid email",
        "age": "must be >= 0"
      }
    }
  }
}
```

## Documentation

The API has a machine-readable spec (OpenAPI for REST, schema files for GraphQL). The spec is the source of truth for client SDKs and docs. If you have to choose between updating the spec and updating prose docs, update the spec.
