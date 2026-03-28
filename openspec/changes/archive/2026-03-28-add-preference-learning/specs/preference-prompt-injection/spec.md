# preference-prompt-injection Specification

## Purpose
Inject learned preferences into context for downstream use.

## ADDED Requirements

### Requirement: Layered injection
The system SHALL inject preferences in distinct layers: preferences, decisions, success patterns.

#### Scenario: Layered injection output
- **WHEN** context injection is requested
- **THEN** the output includes separate sections for:
  - General preferences (e.g., "User prefers TypeScript")
  - Specific decisions (e.g., "User chose Jest for testing")
  - Success patterns (e.g., "This approach worked well before")

### Requirement: Preference injection budget
The system SHALL limit injected preferences to a budget.

#### Scenario: Budget enforcement
- **WHEN** preference injection would exceed budget
- **THEN** lower-confidence preferences are omitted
- **AND** at least high-confidence preferences are included

### Requirement: Injection mode configuration
The system SHALL support configurable injection modes.

#### Scenario: Configurable injection
- **WHEN** injection mode is set to "budget"
- **THEN** preferences are injected until budget is consumed
- **AND** when set to "fixed", a fixed number are injected

### Requirement: Preference injection triggers
The system SHALL inject preferences at appropriate triggers.

#### Scenario: Injection on session start
- **WHEN** a new session begins
- **AND** preferences exist for the scope
- **THEN** preferences are injected into system context

#### Scenario: Injection on relevant task
- **WHEN** task context matches a preference category
- **THEN** relevant preferences are injected
