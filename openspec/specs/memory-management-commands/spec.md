# memory-management-commands Specification

## Purpose
TBD - created by archiving change add-lancedb-memory-provider. Update Purpose after archive.
## Requirements
### Requirement: Memory search command
The system MUST provide a memory search command that accepts free-text query and returns ranked matching memories, and the project MUST provide automated verification that search output remains usable for operators during release-readiness checks.

#### Scenario: Search memory by troubleshooting phrase
- **WHEN** user executes memory search with a phrase such as `Docker build 最佳化`
- **THEN** the system returns ranked results with identifiers and summary context

#### Scenario: Search output is validated in release workflow
- **WHEN** maintainers run the command validation workflow
- **THEN** the workflow verifies that search output includes ranked entries with stable identifiers and readable summaries

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
