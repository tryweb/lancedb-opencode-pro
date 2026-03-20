## Context

`0.1.5` introduced the `source` field on recall effectiveness events and updated new-table bootstrap rows accordingly. Existing local databases created before that release keep the older LanceDB schema because `MemoryStore.init()` opens tables in place and does not run any compatibility checks. The next recall write then fails at the LanceDB layer because the row contains `source` while the existing `effectiveness_events` table schema does not.

## Goals / Non-Goals

**Goals:**
- Make upgraded installs able to open pre-`0.1.5` databases and append new recall events without manual cleanup.
- Keep the fix scoped to the existing `effectiveness_events` table and the missing `source` column.
- Preserve current summary semantics where legacy rows are interpreted as `system-transform` recall events.
- Add regression tests that prove the startup upgrade path works against an old on-disk schema.

**Non-Goals:**
- Introducing a generic migration framework for every future schema change in this patch.
- Rewriting historical events to backfill exact `source` values beyond the safe default interpretation.
- Changing memory record schema or retrieval behavior.

## Decisions

### Decision: Patch the table during store initialization
Rationale: The failure happens before normal event processing can recover, so startup is the only reliable place to make the table schema compatible. This also keeps the repair transparent to operators.

Alternatives considered:
- Fail fast with a manual migration instruction: rejected because local upgrades would remain broken until operators intervene.
- Catch write errors and retry with a reduced payload: rejected because it hides the schema mismatch and loses `source` data on all new rows.

### Decision: Use LanceDB schema evolution to add `source` as an all-null or empty-string-compatible column
Rationale: LanceDB requires explicit schema evolution for new columns. Adding the column in place preserves existing data and unblocks new writes without rebuilding the table.

Alternatives considered:
- Drop and recreate `effectiveness_events`: rejected because it destroys historical audit data.
- Create a new events table name: rejected because it complicates reads and splits history.

### Decision: Keep legacy row normalization defaulting missing `source` to `system-transform`
Rationale: Pre-`0.1.5` recall events only came from the system transform path, so this remains the correct backward-compatible interpretation even after the storage schema is patched.

## Risks / Trade-offs

- [LanceDB API shape differs across installed versions] -> Mitigation: keep the table type narrow, feature-detect schema patch support needed by this project version, and verify with regression tests.
- [Older databases may contain no event rows yet] -> Mitigation: patch logic must be idempotent and succeed whether the table is empty or populated.
- [Future columns repeat this issue] -> Mitigation: structure the init-time compatibility check so additional column patches can be appended later.

## Migration Plan

1. On `MemoryStore.init()`, open `effectiveness_events` and inspect/patch the schema before any writes.
2. If `source` is missing, add it with a backward-compatible default that does not rewrite business meaning for existing rows.
3. Continue normal initialization and event writes.
4. If patching fails, surface a clear initialization error rather than allowing a later opaque write failure.

## Open Questions

- None for this scoped fix.
