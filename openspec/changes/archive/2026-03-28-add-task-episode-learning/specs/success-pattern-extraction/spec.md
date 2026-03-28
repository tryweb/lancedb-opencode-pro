## ADDED Requirements

### Requirement: Extract commands from successful episodes
The system SHALL extract command sequences from successful task episodes.

#### Scenario: Commands extracted
- **WHEN** task episode completes with state "success"
- **THEN** command sequence is stored as a success pattern

### Requirement: Extract working approaches
The system SHALL extract working approaches (libraries, configurations) from successful episodes.

#### Scenario: Approach extracted
- **WHEN** successful episode used "jest" for testing and "prettier" for formatting
- **THEN** these tools are recorded in success pattern

### Requirement: Pattern confidence scoring
The system SHALL calculate confidence based on frequency of pattern occurrence.

#### Scenario: High confidence pattern
- **WHEN** a pattern appears in 5+ successful episodes
- **THEN** confidence is scored at 0.8+
