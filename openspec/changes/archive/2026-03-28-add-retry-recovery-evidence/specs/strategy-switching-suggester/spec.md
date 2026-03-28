## ADDED Requirements

### Requirement: Fallback strategy suggestion
The system SHALL suggest fallback approaches after repeated failures.

#### Scenario: Suggest fallback
- **WHEN** task "npm build" failed 3 times
- **AND** similar task succeeded with "npm run build:prod"
- **THEN** suggests alternative command

### Requirement: Backoff strategy suggestion
The system SHALL suggest exponential backoff after failed retries.

#### Scenario: Suggest backoff
- **WHEN** 2 rapid retries failed
- **THEN** suggests waiting 5s before next retry

### Requirement: Strategy confidence
The system SHALL provide confidence score for suggested strategies.

#### Scenario: High confidence suggestion
- **WHEN** strategy succeeded in 5+ similar cases
- **THEN** confidence is 0.8+
