# preference-profile-aggregator Specification

## Purpose
Aggregate preference signals from memory content into structured preference profiles.

## ADDED Requirements

### Requirement: Preference signal detection
The system SHALL detect preference signals in memory content through pattern matching.

#### Scenario: Preference detected from content
- **WHEN** memory content contains preference markers (e.g., "I prefer", "always use", "never")
- **THEN** the system extracts the preference as a signal
- **AND** the signal is stored in the preference profile

### Requirement: Preference profile structure
The system SHALL maintain preference profiles organized by scope and category.

#### Scenario: Profile organized by scope
- **WHEN** preferences are aggregated
- **AND** user queries for project-scoped preferences
- **THEN** only project-scoped preferences are returned

#### Scenario: Profile organized by category
- **WHEN** preferences have category labels (e.g., "language", "tool", "style")
- **THEN** preferences are grouped by category
- **AND** category-specific queries return relevant preferences

### Requirement: Preference confidence
The system SHALL calculate confidence for aggregated preferences based on signal frequency.

#### Scenario: Preference confidence calculation
- **WHEN** the same preference is expressed multiple times
- **THEN** confidence increases with signal count
- **AND** confidence decreases over time (decay)

### Requirement: Preference profile query
The system SHALL provide a way to query the current preference profile.

#### Scenario: Query preferences
- **WHEN** system requests preference profile for a scope
- **THEN** aggregated preferences are returned with confidence scores
