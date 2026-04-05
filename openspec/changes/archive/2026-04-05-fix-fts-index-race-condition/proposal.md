## Why

When multiple OpenCode processes start simultaneously (e.g., opening multiple tabs or sessions), each instance calls `ensureIndexes()` on the same LanceDB table. The existing check-then-create pattern has a TOCTOU (Time-Of-Check-Time-Of-Use) race window: two processes both see no index, both attempt creation, and the second one fails with `Retryable commit conflict for version N`. Because the retry logic does not re-verify index existence after a conflict failure, the index is incorrectly declared failed even though it was successfully created by the concurrent process — causing a permanent false-negative fallback to BM25-only or vector-only mode.

## What Changes

- Detect `Retryable commit conflict` errors as a distinct case from general failures
- After a commit-conflict catch, re-verify index existence before counting the attempt as failed
- If the index exists post-conflict, adopt it as success (treat as created by concurrent process)
- Add randomized jitter to retry backoff to prevent thundering-herd re-collision
- Final-pass existence check after all retries exhausted, to prevent false-negative reporting

## Capabilities

### New Capabilities
<!-- None introduced -->

### Modified Capabilities
- `index-retry`: Add concurrent-process conflict resolution scenarios — commit-conflict errors must re-verify index existence before being counted as failures, and jitter must be added to retry backoff

## Impact

- `src/store.ts`: `createVectorIndexWithRetry()` and `createFtsIndexWithRetry()` — error handling in catch blocks, backoff delay formula
- No API surface changes, no config changes, no schema changes
- Fixes false-negative `indexState.fts = false` / `indexState.vector = false` when another process wins the race
