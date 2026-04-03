## Context

The current implementation in `src/store.ts` creates and manages the `effectiveness_events` table but has no cleanup mechanism. Event records accumulate indefinitely.

## Goals / Non-Goals

**Goals:**
- Add configurable TTL for effectiveness events (default: 90 days)
- Implement automatic cleanup on plugin initialization
- Provide manual cleanup tool for users
- Add archival export capability before deletion
- Integrate TTL info into existing `memory_stats` tool

**Non-Goals:**
- Not implementing real-time event expiration (polling is sufficient)
- Not changing the core event capture/recall logic
- Not adding backup/restore for events (only archival export)

## Decisions

| Decision | Choice | Why | Trade-off |
|---|---|---|---|
| Runtime surface | hybrid (internal-api + opencode-tool) | Automatic cleanup via init, manual via tool | Clean separation of concerns |
| Entrypoint (internal) | `src/store.ts` -> `cleanupExpiredEvents()` called from `init()` | Aligns with existing pattern | Slight init time increase |
| Entrypoint (tool) | `src/tools/memory.ts` -> `memory_event_cleanup` tool | Direct user control | Additional tool registration |
| Retention scope | Per-scope (project + global separately) | Allows different policies per scope | More complex query logic |
| Archival format | JSON export to user-specified path | Universal compatibility | Limited to file system |
| Config location | `retention.effectivenessEventsDays` in config.json | Consistent with existing config structure | Need config schema update |

## Risks / Trade-offs

- **Risk**: Cleanup on init could slow down plugin startup significantly if many events need deletion
- **Mitigation**: Use batch delete with WHERE clause, add cleanup threshold (e.g., only clean if >1000 expired)
- **Alternative considered**: Scheduled cleanup (cron-like) - but adds complexity; init-based is simpler
- **Trade-off**: Default 90 days might be too short/long for some users - make it configurable

## Operability

### Internal API (Automatic Cleanup)

- **Trigger path**: Called automatically on `MemoryStore.init()` after tables are ready
- **Expected behavior**: 
  - Query events where `timestamp < (now - retentionDays * 86400000)`
  - Delete in batches of 1000
  - Log count of deleted events
- **Failure behavior**: Log error but continue init (non-blocking)

### OpenCode Tool (Manual Cleanup)

- **Trigger path**: User calls `memory_event_cleanup` with optional parameters
- **Parameters**:
  - `scope`: optional scope filter (default: all)
  - `dryRun`: boolean to preview without deleting
  - `archivePath`: optional path to export JSON before deletion
- **Expected output**: JSON with `deletedCount`, `archivedCount` (if applicable), `remainingCount`

### memory_stats Integration

- Add to existing output:
  ```json
  {
    "eventTtl": {
      "enabled": true,
      "retentionDays": 90,
      "expiredCount": 150,
      "scopeBreakdown": { "project:xxx": 100, "global": 50 }
    }
  }
  ```

### Misconfiguration Behavior

- `retentionDays = 0`: No cleanup, events kept forever
- `retentionDays < 0`: Config validation error at init
- Invalid `archivePath`: Tool returns error, no deletion occurs