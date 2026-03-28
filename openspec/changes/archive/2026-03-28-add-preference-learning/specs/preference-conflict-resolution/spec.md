# preference-conflict-resolution Specification

## Purpose
Define rules for resolving conflicting preference signals.

## ADDED Requirements

### Requirement: Recency priority
The system SHALL prioritize recent preference signals over older ones.

#### Scenario: Recent preference wins
- **WHEN** a preference "use Rust" was expressed today
- **AND** the same preference "use Go" was expressed last month
- **THEN** the system resolves to "use Rust"

### Requirement: Direct signal priority
The system SHALL prioritize direct user signals over inferred signals.

#### Scenario: Direct signal wins
- **WHEN** user explicitly says "I prefer TypeScript"
- **AND** system inferred "prefers JavaScript" from code patterns
- **THEN** explicit preference takes precedence

### Requirement: Conflict logging
The system SHALL log preference conflicts for audit.

#### Scenario: Conflict detected
- **WHEN** conflicting preferences are resolved
- **THEN** the resolution is logged with both signals
- **AND** the winning signal is recorded

### Requirement: Confidence adjustment
The system SHALL adjust confidence based on conflict resolution.

#### Scenario: Resolved conflict affects confidence
- **WHEN** a preference wins a conflict
- **AND** the winning preference has lower raw confidence
- **THEN** the resolved confidence reflects the resolution
