# memory-usage-stats Specification

## Purpose

Track recall usage statistics for each memory entry to enable smart unused memory detection and provide usage insights.

## Requirements

### Requirement: Usage statistics fields

The system MUST store usage statistics on each memory record:
- `lastRecalled`: Unix timestamp of most recent recall (0 if never recalled)
- `recallCount`: Total number of times this memory was returned in recall results
- `projectCount`: Number of distinct project scopes that have recalled this memory

#### Scenario: New memory has zero usage
- **WHEN** a new memory is stored
- **THEN** `lastRecalled` is 0, `recallCount` is 0, and `projectCount` is 0

#### Scenario: Usage fields are queryable
- **WHEN** memories are listed or searched
- **THEN** usage statistics are included in the response

### Requirement: Usage tracking on recall

The system MUST update usage statistics when a memory is returned in recall results.

#### Scenario: Global memory recalled in search
- **WHEN** a global memory is returned in `memory_search` results
- **THEN** `recallCount` is incremented by 1
- **AND** `lastRecalled` is updated to current timestamp
- **AND** `projectCount` is updated if the project scope is new

#### Scenario: Global memory recalled in auto-inject
- **WHEN** a global memory is injected into system context
- **THEN** `recallCount` is incremented by 1
- **AND** `lastRecalled` is updated to current timestamp

### Requirement: Smart unused detection

The system MUST use actual recall usage to identify unused global memories.

#### Scenario: Memory not recalled in threshold period
- **WHEN** a global memory has `lastRecalled` older than `unusedDaysThreshold`
- **THEN** the memory is flagged as unused

#### Scenario: Memory recalled recently
- **WHEN** a global memory has `lastRecalled` within `unusedDaysThreshold`
- **THEN** the memory is NOT flagged as unused, regardless of storage age

### Requirement: Usage statistics in global list

The system MUST include usage statistics in `memory_global_list` output.

#### Scenario: List global memories with usage
- **WHEN** user invokes `memory_global_list`
- **THEN** each entry includes `lastRecalled`, `recallCount`, and `projectCount`

#### Scenario: Filter by unused
- **WHEN** user invokes `memory_global_list` with `filter: "unused"`
- **THEN** only memories with `lastRecalled` older than threshold are returned
