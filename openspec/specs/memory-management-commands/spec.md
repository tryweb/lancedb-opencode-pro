# memory-management-commands Specification

## Purpose
TBD - created by archiving change add-lancedb-memory-provider. Update Purpose after archive.
## Requirements
### Requirement: Memory search command
The system MUST provide a memory search command that accepts free-text query and returns ranked matching memories, and the project MUST provide automated verification that search output remains usable for operators during release-readiness checks. The memory search command MUST emit a structured recall event for effectiveness tracking with source as manual-search and injected as false.

#### Scenario: Search memory by troubleshooting phrase
- **WHEN** user executes memory search with a phrase such as `Docker build 最佳化`
- **THEN** the system returns ranked results with identifiers and summary context

#### Scenario: Search output is validated in release workflow
- **WHEN** maintainers run the command validation workflow
- **THEN** the workflow verifies that search output includes ranked entries with stable identifiers and readable summaries

#### Scenario: Manual search emits recall event
- **WHEN** user executes memory search
- **THEN** the system records a recall event with source manual-search, the result count, and injected false

### Requirement: Memory delete command
The system MUST provide a targeted memory delete command by memory id.

#### Scenario: Delete obsolete entry
- **WHEN** user executes delete with an existing memory id
- **THEN** the targeted memory is removed and the command reports success

### Requirement: Scope clear command
The system MUST provide scope-level memory clearing with explicit scope selector.

#### Scenario: Clear one project scope
- **WHEN** user executes clear with `--scope=<project-scope>`
- **THEN** only memories in the specified scope are removed and other scopes remain intact

### Requirement: Destructive operation safeguards
The system MUST require confirmation or equivalent safety validation before irreversible delete/clear execution, and the project MUST provide automated tests that prove destructive actions are rejected without confirmation.

#### Scenario: Clear requested without safety confirmation
- **WHEN** user invokes clear without required safety confirmation signal
- **THEN** the command is rejected with guidance for safe execution

#### Scenario: Delete requested without safety confirmation
- **WHEN** user invokes delete without required safety confirmation signal
- **THEN** the command is rejected with guidance for safe execution and the target memory remains present

### Requirement: Memory-backed port planning command
The system MUST provide a memory management command that plans host port mappings for Docker Compose services and can persist reservations for cross-project conflict avoidance.

#### Scenario: Command returns readable plan output
- **WHEN** user invokes the port planning command with project and service inputs
- **THEN** the command returns machine-readable assignment details including project, service name, host port, container port, protocol, and whether reservation persistence was executed

#### Scenario: Command avoids known and live conflicts
- **WHEN** requested preferred ports overlap with existing global reservations or currently occupied host ports
- **THEN** the command selects alternative ports within the requested range and reports the resulting assignments

### Requirement: Missing-memory feedback command
The system MUST provide a structured command for users to report information that should have been stored as durable memory but was not.

#### Scenario: User reports missing memory
- **WHEN** a user submits missing-memory feedback with text and optional category/context labels
- **THEN** the system stores a false-negative evaluation event that can be included in effectiveness summaries

### Requirement: Wrong-memory feedback command
The system MUST provide a structured command for users to report an existing stored memory that should not have been stored or is no longer appropriate.

#### Scenario: User flags incorrect stored memory
- **WHEN** a user submits wrong-memory feedback referencing a memory identifier and reason label
- **THEN** the system stores a false-positive evaluation event linked to that memory identifier

### Requirement: Recall usefulness feedback command
The system MUST provide a structured command for users to report whether a recalled memory was helpful.

#### Scenario: User confirms recalled memory was useful
- **WHEN** a user submits usefulness feedback for a recalled memory result
- **THEN** the system stores a helpfulness evaluation event that can be aggregated in recall-quality reporting

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

