# kpi-retry-success Specification

## Purpose
Calculate retry-to-success rate from episodic task records to measure learning effectiveness.

## ADDED Requirements

### Requirement: Retry-to-success rate calculation
The system SHALL calculate the retry-to-success rate from episodic task records.

Runtime Surface: internal-api
Entrypoint: `src/store.ts` -> `calculateRetryToSuccessRate()`

#### Scenario: Calculate rate with sufficient data
- **WHEN** there are 5+ failed tasks with retry attempts
- **THEN** the system returns rate = (tasks succeeded after retries) / (total failed tasks)
- **AND** the result includes total tasks, succeeded-after-retry count, and sample count

#### Scenario: Insufficient data
- **WHEN** there are fewer than 5 failed tasks
- **THEN** the system returns `insufficient-data` status
- **AND** includes current sample count

#### Scenario: No failed tasks
- **WHEN** there are no failed tasks in the scope
- **THEN** the system returns rate = 0 with `no-failed-tasks` status

### Requirement: Time range filtering
The system SHALL support filtering retry-to-success calculation by time range.

Runtime Surface: internal-api
Entrypoint: `src/store.ts` -> `calculateRetryToSuccessRate(scope, days)`

#### Scenario: Filter by days parameter
- **WHEN** `days=30` is specified
- **THEN** only tasks with `startTime >= now - 30 days` are included
- **AND** older tasks are excluded from calculation
