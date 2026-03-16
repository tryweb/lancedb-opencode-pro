## MODIFIED Requirements

### Requirement: Memory search command
The system MUST provide a memory search command that accepts free-text query and returns ranked matching memories, and the project MUST provide automated verification that search output remains usable for operators during release-readiness checks.

#### Scenario: Search memory by troubleshooting phrase
- **WHEN** user executes memory search with a phrase such as `Docker build 最佳化`
- **THEN** the system returns ranked results with identifiers and summary context

#### Scenario: Search output is validated in release workflow
- **WHEN** maintainers run the command validation workflow
- **THEN** the workflow verifies that search output includes ranked entries with stable identifiers and readable summaries

### Requirement: Destructive operation safeguards
The system MUST require confirmation or equivalent safety validation before irreversible delete/clear execution, and the project MUST provide automated tests that prove destructive actions are rejected without confirmation.

#### Scenario: Clear requested without safety confirmation
- **WHEN** user invokes clear without required safety confirmation signal
- **THEN** the command is rejected with guidance for safe execution

#### Scenario: Delete requested without safety confirmation
- **WHEN** user invokes delete without required safety confirmation signal
- **THEN** the command is rejected with guidance for safe execution and the target memory remains present
