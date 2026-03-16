## ADDED Requirements

### Requirement: Active project scope derivation
The system MUST derive an active project memory scope from current Git/worktree context.

#### Scenario: User switches repository directory
- **WHEN** user switches from one project directory to another with different Git identity
- **THEN** the active memory scope changes to the target project's scope before retrieval and capture

### Requirement: Scope-constrained retrieval
The system MUST constrain memory retrieval to the active scope and explicitly allowed shared scopes.

#### Scenario: Query in personal project
- **WHEN** retrieval runs inside a personal project scope
- **THEN** company project memories are excluded unless explicitly shared through an allowed scope rule

### Requirement: Scope-aware write path
The system MUST write auto-captured memories into the active scope by default.

#### Scenario: Auto-capture after project-specific task
- **WHEN** a project-specific session produces a durable decision
- **THEN** the stored memory is tagged with the active project scope instead of global scope
