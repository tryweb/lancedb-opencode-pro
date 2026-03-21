# memory-dual-scope-recall Specification

## Purpose

When retrieving memories, automatically include both project-scoped and relevant global-scoped memories, with appropriate score weighting to prioritize project context.

## Requirements

### Requirement: Dual-scope parallel query

The system MUST query both the active project scope and the global scope in parallel when executing `memory_search`.

#### Scenario: Dual-scope search
- **WHEN** user executes `memory_search` with query "docker alpine"
- **THEN** the system queries memories in both `project:<current-repo>` and `global` scopes
- **AND** results are merged into a single ranked list

### Requirement: Global score discount

The system MUST apply a configurable discount factor (default: 0.7) to global scope scores during merge to prevent drowning out project-specific context.

#### Scenario: Score calculation
- **WHEN** a project memory scores 0.9 and a global memory scores 0.9
- **THEN** the project memory retains 0.9
- **AND** the global memory is discounted to 0.63 (0.9 × 0.7)

### Requirement: Scope metadata in results

The system MUST include scope information in recall results so users can identify the source of each memory.

#### Scenario: Result metadata
- **WHEN** recall results are returned
- **THEN** each result includes `metadata.scope: "project"` or `metadata.scope: "global"`
- **AND** each result includes `metadata.source: "global"` for global memories (distinct from project source)

### Requirement: Global scope inclusion toggle

The system MUST respect a configuration option `includeGlobalScope` (default: `true`) to control whether global memories are included in recall.

#### Scenario: Global inclusion disabled
- **WHEN** `includeGlobalScope` is set to `false`
- **THEN** `memory_search` only queries the project scope
- **AND** no global memories appear in results

### Requirement: Dual-scope recall for auto-recall

The system MUST also apply dual-scope recall during automatic system-transform recall, not just for manual `memory_search`.

#### Scenario: Auto-recall includes global
- **WHEN** the system performs automatic context injection during system.transform
- **THEN** global memories relevant to the query are included with appropriate discounting
