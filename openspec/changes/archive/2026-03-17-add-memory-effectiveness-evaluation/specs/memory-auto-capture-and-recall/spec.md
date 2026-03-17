## ADDED Requirements

### Requirement: Capture and recall evaluation signals
The system MUST emit structured evaluation signals during capture and recall flows so maintainers can diagnose why memories were stored, skipped, retrieved, or not retrieved.

#### Scenario: Auto-capture skipped for a known reason
- **WHEN** auto-capture does not persist a memory candidate because of minimum-length rejection, extraction rejection, initialization failure, or embedding failure
- **THEN** the system records the skip outcome with a normalized reason label suitable for aggregation

#### Scenario: Recall produces ranked results
- **WHEN** recall executes for a user prompt
- **THEN** the system records the query scope, result count, and whether any memory block was injected into prompt context
