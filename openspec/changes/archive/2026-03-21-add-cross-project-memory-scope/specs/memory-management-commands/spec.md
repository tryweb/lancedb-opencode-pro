## MODIFIED Requirements

### Requirement: Scope promotion tool

The system MUST provide a `memory_scope_promote` tool that accepts a memory ID and confirmation flag to promote memories from project to global scope.

#### Scenario: User promotes a memory
- **WHEN** user invokes `memory_scope_promote` with a valid memory ID and `confirm: true`
- **THEN** the memory's scope is updated to `"global"`
- **AND** the tool returns confirmation with the updated memory details

#### Scenario: Promotion without confirmation
- **WHEN** user invokes `memory_scope_promote` without confirmation
- **THEN** the tool returns guidance for safe execution

### Requirement: Scope demotion tool

The system MUST provide a `memory_scope_demote` tool that accepts a memory ID and confirmation flag to demote memories from global to project scope.

#### Scenario: User demotes a memory
- **WHEN** user invokes `memory_scope_demote` with a valid memory ID and `confirm: true`
- **THEN** the memory's scope is updated to `"project"`
- **AND** the tool returns confirmation with the updated memory details

### Requirement: Global memory list tool

The system MUST provide a `memory_global_list` tool that returns all memories with `scope: "global"` and supports optional search query and filtering.

#### Scenario: List all global memories
- **WHEN** user invokes `memory_global_list`
- **THEN** the system returns all global-scoped memories with their IDs, content, timestamps, and usage statistics

#### Scenario: Search within global memories
- **WHEN** user invokes `memory_global_list` with a search query
- **THEN** the system returns global memories matching the query, ranked by relevance

#### Scenario: Filter unused global memories
- **WHEN** user invokes `memory_global_list` with `filter: "unused"`
- **THEN** only memories not recalled in the past 30 days are returned
