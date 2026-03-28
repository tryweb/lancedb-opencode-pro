# memory-record-metadata Specification

## Purpose
Extend MemoryRecord schema with additional metadata fields for preference learning, user identification, and governance.

## ADDED Requirements

### Requirement: User identification fields
The system SHALL support optional userId and teamId fields on MemoryRecord.

#### Scenario: Memory with userId
- **WHEN** a memory is created with userId field
- **THEN** the userId is stored and queryable
- **AND** existing queries without userId continue to work

#### Scenario: Memory with teamId
- **WHEN** a memory is created with teamId field
- **THEN** the teamId is stored and queryable

### Requirement: Source tracking fields
The system SHALL support sourceSessionId field to track the session that originated the memory.

#### Scenario: Memory with source session
- **WHEN** a memory is created with sourceSessionId
- **THEN** the sourceSessionId is stored for audit trails

### Requirement: Confidence scoring
The system SHALL support optional confidence field (0.0-1.0) on MemoryRecord.

#### Scenario: Memory with confidence score
- **WHEN** a memory is created with confidence value
- **THEN** the confidence is stored as a float between 0 and 1

### Requirement: Tags support
The system SHALL support optional tags array on MemoryRecord.

#### Scenario: Memory with tags
- **WHEN** a memory is created with tags ["typescript", "preference"]
- **AND** a subsequent search queries for tag:typescript
- **THEN** the memory is returned in results

### Requirement: Soft-delete status field
The system SHALL support optional status field for soft-delete.

#### Scenario: Memory status field
- **WHEN** a memory is created without status
- **THEN** status defaults to "active"
- **AND** memories with status "disabled" are excluded from search

### Requirement: Parent-child relationships
The system SHALL support optional parentId field for memory relationships.

#### Scenario: Memory with parent
- **WHEN** a memory is created with parentId referencing another memory
- **THEN** the relationship is stored
- **AND** queries can filter by parentId
