## Why

The `ensureIndexes()` function in `src/store.ts` has two critical issues that cause LanceDB index creation to fail permanently:

1. **No retry logic**: When index creation fails due to concurrent transaction conflicts (a known LanceDB behavior), the system silently marks the index as failed and never retries
2. **No idempotency protection**: Each `init()` call attempts to create indexes without checking if they already exist, leading to repeated conflicts

This results in degraded search performance (vector/fts indexes disabled) and poor user experience.

## What Changes

1. **Add retry logic to `ensureIndexes()`** with exponential backoff for index creation
2. **Add idempotency check** before attempting index creation (check if index already exists)
3. **Improve error handling** with structured logging and metrics
4. **Optional backup mechanism** via configuration

## Capabilities

### New Capabilities

- `index-retry-with-backoff`: Retry logic with exponential backoff for index creation failures
- `index-existence-check`: Check if index exists before attempting creation
- `index-creation-logging`: Structured logging for index creation attempts and failures

### Modified Capabilities

- None (pure bug fix + observability enhancement)

## Impact

- **File**: `src/store.ts` - `ensureIndexes()` method
- **Metrics**: `indexState` tracking will include retry counts and last error details
- **User-facing**: No - this is an internal foundation fix
- **Dependencies**: None (no new dependencies)

---

### Runtime Surface

**internal-api**

- Entrypoint: `src/store.ts` -> `MemoryStore.ensureIndexes()` (private)
- Trigger: Called automatically on `MemoryStore.init()` or when index health check occurs via `memory_stats` tool

### Operability

- **Trigger path**: Automatic on plugin init OR user calls `memory_stats` tool
- **Expected visible output**: `memory_stats` tool shows `indexState` with `vector: true/false` and `fts: true/false`
- **Misconfiguration behavior**: If indexes permanently fail, fallback to in-memory vector search continues to work
