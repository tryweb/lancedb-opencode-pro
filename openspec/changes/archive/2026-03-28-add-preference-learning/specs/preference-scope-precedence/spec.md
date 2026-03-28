# preference-scope-precedence Specification

## Purpose
Define scope-level precedence rules for preferences.

## ADDED Requirements

### Requirement: Default scope precedence
The system SHALL default to project scope preferences overriding global scope.

#### Scenario: Project overrides global
- **WHEN** project-scoped preference exists
- **AND** global-scoped preference exists for the same key
- **THEN** project preference takes precedence

### Requirement: Scope precedence query
The system SHALL provide merged preferences respecting scope precedence.

#### Scenario: Query merged preferences
- **WHEN** preferences are requested for scope project:myproject
- **AND** project preferences and global preferences both exist
- **THEN** result reflects project > global precedence

### Requirement: Scope level preference
The system SHALL support querying preferences at specific scope levels.

#### Scenario: Query specific scope only
- **WHEN** preferences are requested with scope=global only
- **AND** project preferences exist
- **THEN** only global preferences are returned

### Requirement: Precedence for same-category preferences
The system SHALL handle same-category preferences across scopes correctly.

#### Scenario: Language preference across scopes
- **WHEN** global says "prefer Python"
- **AND** project says "prefer TypeScript"
- **AND** query asks for effective preferences
- **THEN** TypeScript is returned as the effective preference
