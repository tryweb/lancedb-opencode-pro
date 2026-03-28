## ADDED Requirements

### Requirement: Session start triggers task episode creation
The system SHALL create a task episode record when a new task session begins.

#### Runtime Surface
- Surface: hook-driven
- Entrypoint: src/index.ts → hook "session.start" (TBD if exists)

#### Scenario: Session task starts
- **WHEN** a new task session begins (event type "session.start")
- **THEN** an episode record is created with state "pending" and start timestamp
- **AND** episode ID is stored in session state for subsequent operations

#### Scenario: Embedding unavailable
- **WHEN** session.start fires but embedding service is unavailable
- **THEN** episode creation is skipped with warning logged
- **AND** retry on next session start

---

### Requirement: Tool execution records commands to episode
The system SHALL record command executions within a task episode.

#### Runtime Surface
- Surface: hook-driven
- Entrypoint: src/index.ts → hook "tool.execute"

#### Scenario: Tool executed within task
- **WHEN** a tool "bash" is executed with command "npm run build" within task "task-123"
- **THEN** the command is added to the episode's command list
- **AND** episode is updated with new command timestamp

#### Scenario: No active episode
- **WHEN** tool executes but no active episode exists
- **THEN** command is not recorded
- **AND** no error thrown (graceful degradation)

---

### Requirement: Session end finalizes task episode
The system SHALL finalize task episode on session end with outcome.

#### Runtime Surface
- Surface: hook-driven
- Entrypoint: src/index.ts → hook "session.end"

#### Scenario: Task completes successfully
- **WHEN** task session ends with outcome "success"
- **THEN** episode record is updated with end timestamp and final state "success"
- **AND** success patterns are extracted and stored

#### Scenario: Task fails
- **WHEN** task session ends with outcome "failed"
- **THEN** episode record is updated with end timestamp and state "failed"
- **AND** failure is classified using classifyFailure()

---

### Requirement: Similar task recall on session idle
The system SHALL recall similar past tasks before execution context is injected.

#### Runtime Surface
- Surface: hook-driven
- Entrypoint: src/index.ts → hook "experimental.chat.system.transform"

#### Scenario: Similar task found
- **WHEN** session.idle fires and similar tasks exist (similarity >= 0.85)
- **THEN** similar task commands and outcomes are injected into system prompt
- **AND** recall is logged as event

#### Scenario: No similar task
- **WHEN** no similar tasks found
- **THEN** no injection occurs
- **AND** no error (normal behavior)
