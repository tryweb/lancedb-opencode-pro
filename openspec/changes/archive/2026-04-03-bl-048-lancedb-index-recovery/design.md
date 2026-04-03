## Context

The current `ensureIndexes()` implementation in `src/store.ts:1959-1983` has the following issues:

1. **No retry mechanism**: When `table.createIndex()` fails (e.g., due to concurrent transaction conflict), the error is caught and `indexState` is set to `false` permanently
2. **No idempotency**: Every `init()` call attempts to create indexes without checking existence
3. **Poor observability**: No structured logging or metrics for debugging index failures

## Goals / Non-Goals

**Goals:**
- Add retry logic with exponential backoff to handle transient index creation failures
- Check index existence before attempting creation to prevent conflicts
- Add structured logging for observability
- Maintain backward compatibility - all existing APIs work unchanged

**Non-Goals:**
- Not adding a full backup mechanism (moved to separate BL if needed)
- Not changing the vector search fallback behavior
- Not adding user-facing backup configuration (out of scope for this fix)

## Decisions

| Decision | Choice | Why | Trade-off |
|---|---|---|---|
| Runtime surface | internal-api | Index creation is internal plugin logic, not user-facing | Users cannot manually trigger index creation |
| Retry strategy | Exponential backoff (3 attempts, 500ms/1s/2s) | Balances quick recovery with avoiding thundering herd | Additional ~4s max delay on init |
| Idempotency check | Use `table.index()` to check existence before create | LanceDB provides this API natively | Slight overhead on each init (negligible) |
| Error handling | Log structured error, continue with fallback | Ensure plugin remains operable even if indexes fail | May mask underlying issues if not monitored |

## Risks / Trade-offs

- **Risk**: Retry logic could mask a persistent underlying issue (e.g., corrupt DB file)
- **Mitigation**: Add structured logging so operators can identify patterns in failures
- **Trade-off**: Additional init time due to retry backoff (max ~4 seconds)
- **Alternative considered**: Use LanceDB's native index creation with `ifNotExists` option - but this is already implicitly handled by LanceDB; the real issue is transaction conflicts which require retry logic
