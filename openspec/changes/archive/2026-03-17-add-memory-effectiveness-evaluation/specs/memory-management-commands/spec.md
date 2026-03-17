## ADDED Requirements

### Requirement: Missing-memory feedback command
The system MUST provide a structured command for users to report information that should have been stored as durable memory but was not.

#### Scenario: User reports missing memory
- **WHEN** a user submits missing-memory feedback with text and optional category/context labels
- **THEN** the system stores a false-negative evaluation event that can be included in effectiveness summaries

### Requirement: Wrong-memory feedback command
The system MUST provide a structured command for users to report an existing stored memory that should not have been stored or is no longer appropriate.

#### Scenario: User flags incorrect stored memory
- **WHEN** a user submits wrong-memory feedback referencing a memory identifier and reason label
- **THEN** the system stores a false-positive evaluation event linked to that memory identifier

### Requirement: Recall usefulness feedback command
The system MUST provide a structured command for users to report whether a recalled memory was helpful.

#### Scenario: User confirms recalled memory was useful
- **WHEN** a user submits usefulness feedback for a recalled memory result
- **THEN** the system stores a helpfulness evaluation event that can be aggregated in recall-quality reporting
