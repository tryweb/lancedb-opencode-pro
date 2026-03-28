## ADDED Requirements

### Requirement: Task episode capture on session start
The system SHALL create a task episode record when a new task session begins.

#### Scenario: Session task starts
- **WHEN** a new task session begins
- **THEN** an episode record is created with state "pending" and start timestamp

### Requirement: Task episode capture on command execution
The system SHALL record command executions within a task episode.

#### Scenario: Command recorded
- **WHEN** a command "npm run build" is executed within task "task-123"
- **THEN** the command is added to the episode's command list

### Requirement: Task episode completion
The system SHALL finalize task episode on completion with outcome.

#### Scenario: Task completes
- **WHEN** task "task-123" completes with outcome "success"
- **THEN** episode record is updated with end timestamp and final state
