## ADDED Requirements

### Requirement: Type check result ingestion
The system SHALL parse and store type check results from validation output.

#### Scenario: Type check passes
- **WHEN** type check runs and passes with no errors
- **THEN** validation outcome is recorded as "type-check-pass"

#### Scenario: Type check fails
- **WHEN** type check reports 3 errors
- **THEN** validation outcome is recorded with error count and types

### Requirement: Build result ingestion
The system SHALL parse and store build results.

#### Scenario: Build succeeds
- **WHEN** build command succeeds
- **THEN** validation outcome is recorded as "build-pass"

### Requirement: Test result ingestion
The system SHALL parse and store test execution results.

#### Scenario: Tests pass
- **WHEN** test suite runs with 10 passed, 0 failed
- **THEN** validation outcome is recorded with pass/fail counts
