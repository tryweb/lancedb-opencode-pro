# memory-explicit-remember Specification

## Purpose
Enable users to explicitly capture memories with optional contextual labels.

## ADDED Requirements

### Requirement: Explicit memory capture command
The system SHALL provide an explicit memory capture command that accepts content text and optional context/category labels.

#### Scenario: User captures explicit memory
- **WHEN** user invokes remember command with content "Always use TypeScript for new projects"
- **THEN** the memory is stored with content "Always use TypeScript for new projects"
- **AND** the memory is marked with source as explicit-remember

#### Scenario: User captures memory with category label
- **WHEN** user invokes remember command with content and category "preference"
- **THEN** the memory is stored with the category label attached
- **AND** the category is queryable in search

#### Scenario: Explicit memory triggers effectiveness tracking
- **WHEN** user successfully captures an explicit memory
- **THEN** the system records a capture event with source explicit-remember
- **AND** the event is included in effectiveness summaries

### Requirement: Minimum content threshold
The system SHALL apply the same minimum character threshold to explicit memories as auto-capture.

#### Scenario: Explicit memory below threshold
- **WHEN** user invokes remember command with content shorter than minCaptureChars
- **THEN** the command returns a warning that content is too short
- **AND** no memory is stored
