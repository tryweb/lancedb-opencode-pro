# memory-management-commands Specification

## Purpose
TBD - created by archiving change add-lancedb-memory-provider. Update Purpose after archive.
## Requirements
### Requirement: Memory search command
The system MUST provide a memory search command that accepts free-text query and returns ranked matching memories.

#### Scenario: Search memory by troubleshooting phrase
- **WHEN** user executes memory search with a phrase such as `Docker build 最佳化`
- **THEN** the system returns ranked results with identifiers and summary context

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
The system MUST require confirmation or equivalent safety validation before irreversible delete/clear execution.

#### Scenario: Clear requested without safety confirmation
- **WHEN** user invokes clear without required safety confirmation signal
- **THEN** the command is rejected with guidance for safe execution

