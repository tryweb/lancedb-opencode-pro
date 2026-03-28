## ADDED Requirements

### Requirement: Retry attempt tracking
The system SHALL record retry attempts with attempt number and outcome.

#### Scenario: Retry recorded
- **WHEN** task fails and is retried
- **THEN** retry attempt is recorded with attempt number and outcome

### Requirement: Recovery strategy tracking
The system SHALL record which recovery strategies were attempted.

#### Scenario: Strategy recorded
- **WHEN** task uses "restart service" as recovery
- **THEN** recovery strategy is recorded in evidence

### Requirement: Evidence query by task type
The system SHALL allow querying evidence by task type or error type.

#### Scenario: Query by error type
- **WHEN** querying evidence for "TypeError" failures
- **THEN** returns all retry/recovery records for that error type
