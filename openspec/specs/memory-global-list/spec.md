# memory-global-list Specification

## Purpose

Provide a tool for users to view and search all global-scoped memories across projects.

## Requirements

### Requirement: List global memories tool

The system MUST provide a `memory_global_list` tool that returns all memories with `scope: "global"`.

#### Scenario: List all global memories
- **WHEN** user invokes `memory_global_list`
- **THEN** the system returns all global-scoped memories with their IDs, content, and timestamps

#### Scenario: Search within global memories
- **WHEN** user invokes `memory_global_list` with a search query
- **THEN** the system returns global memories matching the query, ranked by relevance

### Requirement: Global memory details

The system MUST include usage statistics for each global memory.

#### Scenario: Memory usage tracking
- **WHEN** global memories are returned
- **THEN** each entry includes:
  - `lastRecalled`: timestamp of most recent recall
  - `recallCount`: total number of times recalled
  - `projectCount`: number of distinct projects that have recalled this memory

### Requirement: Global memory filtering

The system MUST support filtering global memories by usage status.

#### Scenario: Filter unused memories
- **WHEN** user invokes `memory_global_list` with `filter: "unused"`
- **THEN** only memories not recalled in the past 30 days are returned

#### Scenario: Filter frequently used memories
- **WHEN** user invokes `memory_global_list` with `filter: "frequently_used"`
- **THEN** memories with high recall counts are prioritized in results
