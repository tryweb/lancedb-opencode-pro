# memory-learning-summary Specification

## Purpose
Provide users with a view of what the system has learned recently.

## ADDED Requirements

### Requirement: Learning summary command
The system SHALL provide a command that returns a summary of recently captured memories.

#### Scenario: User requests learning summary
- **WHEN** user invokes what-did-you-learn command
- **THEN** the system returns a summary of memories captured in the past 7 days
- **AND** the summary is organized by category when categories exist

#### Scenario: Summary with custom time window
- **WHEN** user invokes what-did-you-learn with days=30
- **THEN** the system returns memories from the past 30 days

#### Scenario: Empty summary for new users
- **WHEN** user invokes what-did-you-learn with no prior memories
- **THEN** the system returns a message indicating no memories captured yet

### Requirement: Summary includes memory counts
The system SHALL provide memory counts by category in the summary.

#### Scenario: Summary shows category breakdown
- **WHEN** user invokes what-did-you-learn
- **THEN** the response includes count of memories per category
- **AND** total memory count is included
