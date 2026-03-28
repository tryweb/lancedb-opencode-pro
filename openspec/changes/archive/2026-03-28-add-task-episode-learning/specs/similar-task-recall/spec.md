## ADDED Requirements

### Requirement: Similar task search
The system SHALL find similar past tasks using vector similarity.

#### Scenario: Similar task found
- **WHEN** new task "fix auth bug" starts
- **AND** past task "fix login bug" has similarity >= 0.85
- **THEN** past task is recalled and presented

### Requirement: Recall with context
The system SHALL provide full episode context when recalling similar tasks.

#### Scenario: Context provided
- **WHEN** similar task is recalled
- **THEN** response includes command sequence, validation outcomes, and final state

### Requirement: Recall threshold configuration
The system SHALL allow configuring minimum similarity threshold for recall.

#### Scenario: Custom threshold
- **WHEN** similarity threshold is set to 0.9
- **THEN** only tasks with >= 0.9 similarity are recalled
