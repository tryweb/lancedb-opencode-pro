## ADDED Requirements

### Requirement: `memory_why` explains recall factors for a target memory
The system SHALL provide a `memory_why` tool that returns structured explanation factors for a specified memory ID.

#### Runtime Surface
- Surface: opencode-tool
- Entrypoint: src/index.ts → tool "memory_why"

#### Scenario: Explain an existing memory
- **WHEN** user calls `memory_why` with a valid memory ID in current scope
- **THEN** response includes explanation sections for recency, citation, importance, and scope
- **AND** response includes the memory text summary

#### Scenario: Reject unknown memory ID
- **WHEN** user calls `memory_why` with a non-existing ID
- **THEN** system returns a not-found message

---

### Requirement: explanation exposes recency behavior relative to half-life
The system SHALL expose recency age and decay behavior in explanation output.

#### Runtime Surface
- Surface: opencode-tool
- Entrypoint: src/store.ts → `explainMemory(...)` recency factor generation

#### Scenario: Memory is inside half-life window
- **WHEN** memory age is less than configured `recencyHalfLifeHours`
- **THEN** explanation indicates recent/in-half-life state

#### Scenario: Memory is outside half-life window
- **WHEN** memory age exceeds configured `recencyHalfLifeHours`
- **THEN** explanation indicates older/outside-half-life state and decay context

---

### Requirement: explanation exposes citation status and source
The system SHALL expose citation source and citation status when citation metadata exists.

#### Runtime Surface
- Surface: opencode-tool
- Entrypoint: src/store.ts → `explainMemory(...)` citation factor generation

#### Scenario: Citation metadata exists
- **WHEN** memory has citation source and/or status
- **THEN** explanation includes citation source and status

#### Scenario: Citation metadata is absent
- **WHEN** memory has no citation metadata
- **THEN** explanation degrades gracefully without runtime error

---

### Requirement: explanation exposes scope matching behavior
The system SHALL explain whether memory scope matches current execution scope.

#### Runtime Surface
- Surface: opencode-tool
- Entrypoint: src/store.ts → `explainMemory(...)` scope factor generation

#### Scenario: Scope matches current project
- **WHEN** memory scope equals active project scope
- **THEN** explanation indicates scope match

#### Scenario: Memory comes from global or different scope
- **WHEN** memory scope differs from active project scope
- **THEN** explanation indicates out-of-scope/global origin

---

### Requirement: `memory_explain_recall` explains last recall operation
The system SHALL provide a `memory_explain_recall` tool to explain the latest recall operation in session context.

#### Runtime Surface
- Surface: opencode-tool
- Entrypoint: src/index.ts → tool "memory_explain_recall"

#### Scenario: No previous recall is available
- **WHEN** user calls `memory_explain_recall` before any recall in this session
- **THEN** system returns a no-recent-recall message

#### Scenario: Previous recall exists
- **WHEN** user calls `memory_explain_recall` after `memory_search` or auto-recall
- **THEN** system returns query context and result-level explanation summary

---

### Requirement: explanation requests are observable
The system SHALL make explanation behavior observable for diagnosis and validation.

#### Runtime Surface
- Surface: opencode-tool
- Entrypoint: src/index.ts tool handlers + existing event/summary paths

#### Scenario: Explanation command is executed
- **WHEN** `memory_why` or `memory_explain_recall` is executed
- **THEN** output is inspectable in tool response content
- **AND** behavior is verifiable via integration/e2e tests
