## ADDED Requirements

### Requirement: Budget suggestion based on history
The system SHALL suggest retry budget based on median previous attempts.

#### Scenario: Suggest budget
- **WHEN** task of type "npm install" has history of 2-3 retries
- **THEN** suggested budget is 3 retries

### Requirement: Stop condition suggestion
The system SHALL suggest when to stop retrying based on failure patterns.

#### Scenario: Suggest stop
- **WHEN** all 3+ retries failed with same error
- **THEN** suggestion is to stop and escalate

### Requirement: Minimum sample threshold
The system SHALL require minimum sample size before suggesting budget.

#### Scenario: Insufficient data
- **WHEN** task has fewer than 3 historical examples
- **THEN** no budget suggestion is provided
