# Data Modeling

Schema-first. The shape of the data is the longest-lived decision in a backend; everything else can be rewritten around it.

## Defaults for every table

- **Primary key**: `id` as `uuid` (default) or `bigint` identity. Pick one and use it everywhere; don't mix.
- **Timestamps**: `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()` with a trigger or app-level update.
- **Deletion strategy**: choose one explicitly — hard delete, soft delete (`deleted_at timestamptz`), or archive table. Document it. Soft delete leaks into every query; only use it when audit/recovery requires it.
- **Tenancy**: if the system is multi-tenant, every user-scoped table gets a `tenant_id` (or equivalent) **and** an index on it. Tenant isolation is enforced at the data layer, not in handlers.
- **Ownership**: user-scoped rows carry a `user_id` (or `owner_id`) FK. Authorization policies key off this column.

## Normalize first

Start in 3NF. Denormalize only when a measured read pattern justifies it, and document **why** in a comment on the column or table. Premature denormalization causes drift between the duplicated copies; you will eventually have to choose which is the truth.

Acceptable denormalizations:
- Counters (`comment_count` on `posts`) — maintained by trigger or transactionally in the writer.
- Flattened search fields (a `tsvector` column derived from several text columns).
- Snapshots taken at a point in time on purpose (e.g., `invoice.line_items_snapshot` so historical invoices don't change when a product is renamed).

## Types

- **Text**: `text` over `varchar(n)` unless the length cap is a real domain constraint, not a guess.
- **Money**: `numeric(19,4)` or store the smallest unit (cents) as `bigint`. **Never** `float`/`double` for money.
- **Time**: `timestamptz` always. Never `timestamp` (no tz). Store UTC; format on the way out.
- **Enums**: prefer a lookup table with an FK over a database enum. Enums are painful to evolve; lookup tables are not.
- **Booleans for state**: avoid `is_active` + `is_archived` + `is_deleted`. Use a single `status` column with a constrained set of values.
- **JSON**: `jsonb` only. Use for genuinely schemaless data (3rd-party payloads, user-defined fields). Don't use it as a junk drawer to skip schema design.

## Constraints belong in the database

The database is the last line of defense. Application code will be bypassed eventually (a console, a script, another service).

- `not null` is the default; `null` is opt-in with a reason.
- `check` constraints for domain rules (`amount > 0`, `status in (...)`).
- `unique` constraints for natural keys (email, slug per tenant).
- Foreign keys with explicit `on delete` behavior — `cascade`, `restrict`, `set null` — never the default-by-accident.

## Indexing

Default indexes:
- Every FK column.
- Every column used in a `WHERE` clause on a hot read path.
- Composite index ordered to match `(tenant_id, ...)` for multi-tenant lookups.

Specialized indexes when the access pattern calls for it:
- **B-tree**: equality and range. Default.
- **GIN**: array containment, `jsonb` lookups, full-text search (`tsvector`).
- **GIN + trigram (`pg_trgm`)**: fuzzy / `ILIKE '%foo%'` / typo-tolerant search.
- **BRIN**: very large append-only tables ordered by time.
- **Partial index**: `where deleted_at is null` to keep soft-delete queries fast without bloating the index.
- **Unique partial index**: enforce "one active row per X" without blocking historical rows.

Don't index everything — every index slows writes and uses storage. Index the hot path.

## Migrations

- **One change per migration.** Easier to review, easier to revert.
- **Schema and data changes are separate steps.** Add column → backfill → set not null → drop default. Don't bundle.
- **Reversible by default.** Write the down-migration. If a migration is genuinely irreversible (data destruction), mark it explicitly.
- **Long-running migrations don't lock the table.** Use `concurrently` for indexes; backfill in batches; add `not null` after the backfill, not during.
- **Never edit a migration that has run in any shared environment.** Add a new one.

## Identifiers

- **Public IDs**: prefer opaque (`uuid`, or a prefixed slug like `usr_a1b2c3`) over sequential integers. Sequential IDs leak business volume and enable enumeration attacks.
- **Internal IDs**: sequential `bigint` is fine and faster for joins.
- A common pattern: internal `bigint id` + external `uuid public_id` with a unique index.

## Auditability

For anything that touches money, permissions, or contracts: keep an append-only audit log table. The mutable row is the current state; the log is the history. Don't try to make the main table both.
