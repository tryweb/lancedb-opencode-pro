## ADDED Requirements

### Requirement: Episodic task record creation
The system SHALL support creating episodic task records with task ID, session ID, scope, start time, and initial state.

#### Scenario: Task episode starts
- **WHEN** a task begins execution with task ID "task-123" in scope "project:myproject"
- **THEN** an episodic task record is created with state "running"

### Requirement: Task state transitions
The system SHALL support updating task state: pending → running → success | failed | timeout.

#### Scenario: Task succeeds
- **WHEN** task with ID "task-123" completes successfully
- **THEN** the task record state is updated to "success"

#### Scenario: Task fails
- **WHEN** task with ID "task-123" fails
- **THEN** the task record state is updated to "failed"

### Requirement: Failure classification
The system SHALL support classifying failures by taxonomy: syntax, runtime, logic, resource, unknown.

#### Scenario: Failure classified as syntax
- **WHEN** a task fails with syntax error
- **THEN** the failureType field is set to "syntax"

### Requirement: Task episode retrieval
The system SHALL support querying task episodes by scope, state, and time range.

#### Scenario: Query failed tasks
- **WHEN** querying for failed tasks in scope "project:myproject"
- **THEN** returns all task records with state "failed" in that scope
