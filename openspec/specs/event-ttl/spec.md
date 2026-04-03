# event-ttl Specification

## Purpose
TBD - created by archiving change bl-037-event-ttl-archival. Update Purpose after archive.
## Requirements
### Requirement: Configurable Retention Period for Effectiveness Events

The system SHALL support configurable retention period for `effectiveness_events` table records.

**Runtime Surface**: internal-api  
**Entrypoint**: `src/config.ts` -> `resolveMemoryConfig()` + `src/store.ts` -> `cleanupExpiredEvents()`

Configuration: Use `retention.effectivenessEventsDays` in config (default: 90, 0 = disabled) or env var `LANCEDB_OPENCODE_PRO_RETENTION_EVENTS_DAYS`.

#### Scenario: Default retention (90 days)

- **GIVEN** user has no `retention.effectivenessEventsDays` configured
- **WHEN** plugin initializes
- **THEN** events older than 90 days are eligible for cleanup
- **AND** cleanup runs automatically

#### Scenario: Custom retention period

- **GIVEN** user configures `retention.effectivenessEventsDays: 180`
- **WHEN** plugin initializes
- **THEN** events older than 180 days are eligible for cleanup
- **AND** events between 90-180 days are retained

#### Scenario: Disabled retention

- **GIVEN** user configures `retention.effectivenessEventsDays: 0`
- **WHEN** plugin initializes
- **THEN** no automatic cleanup occurs
- **AND** events accumulate indefinitely

---

### Requirement: Automatic Cleanup on Plugin Initialization

The system SHALL automatically clean up expired events when the memory store initializes.

**Runtime Surface**: internal-api  
**Entrypoint**: `src/store.ts` -> `MemoryStore.init()` -> `cleanupExpiredEvents()`

#### Scenario: Cleanup runs on init

- **GIVEN** retention is enabled (retentionDays > 0) and there are expired events
- **WHEN** `MemoryStore.init()` is called
- **THEN** expired events are deleted from `effectiveness_events` table
- **AND** count of deleted events is logged

#### Scenario: Cleanup is non-blocking

- **GIVEN** cleanup operation fails due to error
- **WHEN** `init()` is running
- **THEN** error is logged but initialization continues
- **AND** plugin remains operational

#### Scenario: Empty/no expired events

- **GIVEN** no events have exceeded retention period
- **WHEN** cleanup runs
- **THEN** no deletion occurs
- **AND** operation completes quickly

---

### Requirement: Manual Cleanup Tool

The system SHALL provide an opencode tool for manual event cleanup with optional archival export.

**Runtime Surface**: opencode-tool  
**Entrypoint**: `src/tools/memory.ts` -> `memory_event_cleanup` tool

Tool args: `scope`, `dryRun`, `archivePath`. See `memory_event_cleanup` tool in `src/tools/memory.ts`.

#### Scenario: Dry run preview

- **GIVEN** user calls `memory_event_cleanup` with `dryRun: true`
- **WHEN** tool executes
- **THEN** output shows `expiredCount: N` without deleting any events
- **AND** `wouldDelete: N` is included in response

#### Scenario: Actual cleanup

- **GIVEN** user calls `memory_event_cleanup` without dryRun
- **WHEN** tool executes
- **THEN** expired events are deleted
- **AND** response includes `deletedCount: N`

#### Scenario: Archive before delete

- **GIVEN** user provides `archivePath: "/path/to/export.json"`
- **WHEN** tool executes
- **THEN** expired events are exported to JSON file
- **AND** then deleted from table
- **AND** response includes `archivedCount: N`

#### Scenario: Archive path invalid

- **GIVEN** user provides invalid `archivePath`
- **WHEN** tool executes
- **THEN** error is returned
- **AND** no events are deleted

---

### Requirement: TTL Status in memory_stats

The system SHALL include event TTL information in the `memory_stats` tool output.

**Runtime Surface**: opencode-tool  
**Entrypoint**: `src/tools/memory.ts` -> `memory_stats` tool

#### Scenario: Stats shows TTL info

- **GIVEN** retention is configured with 90 days
- **WHEN** user calls `memory_stats`
- **THEN** output includes:
```json
{
  "eventTtl": {
    "enabled": true,
    "retentionDays": 90,
    "expiredCount": 150,
    "scopeBreakdown": {
      "project:xxx": 100,
      "global": 50
    }
  }
}
```

#### Scenario: Retention disabled

- **GIVEN** retention is disabled (retentionDays: 0)
- **WHEN** user calls `memory_stats`
- **THEN** output includes:
```json
{
  "eventTtl": {
    "enabled": false,
    "retentionDays": 0
  }
}
```

---

### Requirement: Per-Scope Retention

The system SHALL apply retention policies separately per scope (project and global).

**Runtime Surface**: internal-api  
**Entrypoint**: `src/store.ts` -> `cleanupExpiredEvents(scopeFilter)`

#### Scenario: Different scope counts

- **GIVEN** project scope has 200 expired events, global has 50
- **WHEN** cleanup runs
- **THEN** both scopes are cleaned independently
- **AND** scope breakdown reflects actual counts

---

### Requirement: Logging and Metrics

The system SHALL log cleanup operations and track metrics for observability.

**Runtime Surface**: internal-api  
**Entrypoint**: `src/store.ts` -> `cleanupExpiredEvents()`

#### Scenario: Cleanup logs

- **WHEN** cleanup runs
- **THEN** log entries include deleted count and retention days

#### Scenario: Error logging

- **WHEN** cleanup fails
- **THEN** error is logged with message

