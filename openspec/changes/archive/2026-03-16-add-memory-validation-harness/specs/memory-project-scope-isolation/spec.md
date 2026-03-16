## MODIFIED Requirements

### Requirement: Scope-constrained retrieval
The system MUST constrain memory retrieval to the active scope and explicitly allowed shared scopes, and the project MUST provide automated tests that prove no cross-scope leakage across representative multi-project scenarios.

#### Scenario: Query in personal project
- **WHEN** retrieval runs inside a personal project scope
- **THEN** company project memories are excluded unless explicitly shared through an allowed scope rule

#### Scenario: Automated multi-scope validation
- **WHEN** maintainers run the scope-isolation validation workflow across multiple project scopes
- **THEN** records written into one project scope are absent from retrieval results in unrelated project scopes

### Requirement: Scope-aware write path
The system MUST write auto-captured memories into the active scope by default, and the project MUST provide automated checks that verify stored records retain the expected scope after capture and maintenance operations.

#### Scenario: Auto-capture after project-specific task
- **WHEN** a project-specific session produces a durable decision
- **THEN** the stored memory is tagged with the active project scope instead of global scope

#### Scenario: Scope-aware maintenance verification
- **WHEN** maintainers execute validation that writes, lists, deletes, and clears memories across multiple scopes
- **THEN** only the targeted scope is affected by each operation
