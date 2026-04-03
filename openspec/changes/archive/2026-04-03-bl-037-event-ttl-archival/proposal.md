## Why

The `effectiveness_events` table in LanceDB grows unbounded as users continue to use the memory plugin. Each capture, recall, and feedback action generates an event record. Over time:

1. **Storage bloat**: Event records accumulate and consume disk space
2. **Query performance degradation**: Large event tables slow down dashboard/KPI queries
3. **No retention policy**: There is currently no mechanism to clean up old events

This impacts operational costs and system performance for long-running installations.

## What Changes

1. **Add TTL configuration** for `effectiveness_events` table (default: 90 days)
2. **Implement automatic cleanup** that runs on plugin initialization and/or scheduled interval
3. **Add archival export option** for users who want to preserve historical data before deletion
4. **Add tool for manual cleanup** and status inspection

## Capabilities

### New Capabilities

- `event-ttl-config`: Configurable retention period for effectiveness events
- `event-auto-cleanup`: Automatic deletion of events beyond retention period
- `event-archive-export`: Export events to JSON before deletion (optional)
- `event-cleanup-tool`: Manual cleanup trigger and status via opencode-tool

### Modified Capabilities

- `memory_stats`: Add event TTL info to output

## Impact

- **File**: `src/store.ts` - new cleanup methods, config handling
- **Config**: New `retention.effectivenessEventsDays` option (default: 90)
- **User-facing**: Yes - new `memory_event_cleanup` tool, TTL status in `memory_stats`
- **Dependencies**: None (no new dependencies)

---

### Runtime Surface

**hybrid**

- **internal-api**: Automatic cleanup on `MemoryStore.init()` or periodic trigger
- **opencode-tool**: `memory_event_cleanup` for manual trigger and archival export

### Operability

- **Trigger path (internal)**: Automatic on plugin init, optional periodic cleanup
- **Trigger path (tool)**: User calls `memory_event_cleanup` tool manually
- **Expected visible output**: `memory_stats` shows `eventTtl: { enabled: true, retentionDays: 90, expiredCount: N }`
- **Misconfiguration behavior**: If retentionDays is set to 0, no cleanup occurs; negative values are rejected at config validation

---

### Changelog Wording Class

**user-facing** - Users can configure event retention period and manually trigger cleanup. This is an operational improvement.