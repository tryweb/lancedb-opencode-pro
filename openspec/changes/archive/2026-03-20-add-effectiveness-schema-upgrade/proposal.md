## Why

Version `0.1.5` added the `source` field to recall effectiveness events, but existing local LanceDB tables created by older versions are opened as-is and never patched. As a result, upgraded installs can fail on the first recall event write with `Found field not in schema: source at row 0`, breaking message send flows after upgrade.

## What Changes

- Add startup schema compatibility checks for the `effectiveness_events` table before new evaluation events are written.
- Automatically patch older event tables that are missing the `source` column so existing databases remain usable after upgrading to `0.1.5+`.
- Preserve backward-compatible interpretation of historical rows by treating pre-upgrade events as `system-transform` recall events in summaries.
- Add regression coverage for the upgrade path from pre-`0.1.5` event schemas.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `memory-effectiveness-evaluation`: Persisted effectiveness event storage now upgrades older LanceDB schemas before recall events with `source` are appended.

## Impact

- `src/store.ts`: initialization must inspect and patch the `effectiveness_events` table schema.
- `test/foundation/foundation.test.ts`: add coverage for upgrading an older events table and preserving summary behavior.
- Docker-based validation: release verification must prove upgraded databases no longer fail on new recall writes.
