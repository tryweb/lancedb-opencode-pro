# memory-consolidate-tool Specification

## Purpose

Expose a plugin tool `memory_consolidate` that allows operators and AI agents to manually trigger scope-internal memory consolidation on demand. This provides an escape hatch for cleanup without waiting for the `session.compacted` trigger.

## ADDED Requirements

### Requirement: Manual consolidation tool

The system SHALL provide a `memory_consolidate` plugin tool accessible via the AI tool interface.

#### Scenario: Successful manual consolidation
- **WHEN** the AI or operator calls `memory_consolidate(scope="project:abc123", confirm=true)`
- **THEN** the system SHALL call `consolidateScope("project:abc123", dedup.consolidateThreshold)` and SHALL return `{"mergedPairs": N, "deletedRecords": M, "skippedRecords": K, "scope": "project:abc123"}`

#### Scenario: Consolidation requires explicit confirmation
- **WHEN** `memory_consolidate` is called with `confirm` not set to `true`
- **THEN** the system SHALL return an error message requiring `confirm=true` before proceeding

#### Scenario: Consolidation on global scope
- **WHEN** `memory_consolidate(scope="global", confirm=true)` is called
- **THEN** the system SHALL consolidate only within the global scope, following the same rules as project scope consolidation

#### Scenario: Invalid scope format
- **WHEN** `memory_consolidate(scope="invalid-format", confirm=true)` is called
- **THEN** the system SHALL return an error with message `"Invalid scope format"` and SHALL NOT attempt consolidation
