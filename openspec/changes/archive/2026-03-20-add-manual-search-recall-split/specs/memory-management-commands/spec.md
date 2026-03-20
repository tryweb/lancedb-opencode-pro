## MODIFIED Requirements

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
