## Why

Users currently have no way to explicitly manage their memories—capture, retrieval, and deletion are entirely automatic. This limits user control and makes it difficult to teach the system about preferences or correct its understanding. Adding explicit memory commands gives users agency over their memory footprint and enables preference learning.

## What Changes

- Add `/remember` command for explicit memory capture
- Add `/forget` command for explicit memory removal/disabling
- Add `/what-did-you-learn` command for viewing recent learning summary
- All commands integrate with existing effectiveness tracking pipeline

## Capabilities

### New Capabilities

- `memory-explicit-remember`: Explicit memory capture command with optional context/category labels
- `memory-explicit-forget`: Explicit memory removal command with soft-delete and hard-delete options
- `memory-learning-summary`: Recent learning summary view with configurable time window

### Modified Capabilities

- `memory-management-commands`: Extends with three new commands (remember, forget, what-did-you-learn)

## Impact

- New tool implementations in `src/tools/`
- New CLI command handlers
- Schema changes for soft-delete support (optional `status` field on MemoryRecord)
- Integration with existing effectiveness_events table
