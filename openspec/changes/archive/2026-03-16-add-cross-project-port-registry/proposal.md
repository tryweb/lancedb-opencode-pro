## Why

Teams running multiple projects on the same host often generate `docker-compose.yml` files with overlapping host listen ports, causing startup failures and manual rework. We need a durable, host-level memory-backed planning flow that can propose non-conflicting ports before compose files are written.

## What Changes

- Add a new memory-driven port planning capability that proposes host ports per service and reserves them in long-term memory.
- Add a new tool command to compute conflict-free port mappings by combining live host usage checks with remembered reservations.
- Persist reservations in `global` scope so multiple projects on the same host can share a common port registry.
- Add validation tests for deterministic allocation, collision avoidance, and reservation persistence behavior.

## Capabilities

### New Capabilities
- `cross-project-port-registry`: Provide host-level port planning and reservation based on long-term memory records plus current host port availability checks.

### Modified Capabilities
- `memory-management-commands`: Extend memory management tools with a non-destructive port planning command for cross-project compose authoring.

## Impact

- Affected code: `src/index.ts`, new `src/ports.ts`, and regression tests in `test/regression/plugin.test.ts`.
- Behavior impact: introduces a new optional tool for workflow automation; existing memory search/delete/clear/stats behavior remains unchanged.
- Ops impact: enables safer multi-project Docker Compose setup on a single host by reducing host port collisions.
