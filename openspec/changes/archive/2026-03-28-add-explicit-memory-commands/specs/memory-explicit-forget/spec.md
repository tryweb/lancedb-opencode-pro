# memory-explicit-forget Specification

## Purpose
Enable users to explicitly remove or disable memories.

## ADDED Requirements

### Requirement: Soft-delete memory command
The system SHALL provide a forget command that marks memories as disabled without immediate physical deletion.

#### Scenario: User soft-deletes a memory
- **WHEN** user invokes forget command with a valid memory ID (no force flag)
- **THEN** the memory status is set to disabled
- **AND** the memory is excluded from search results
- **AND** the command returns success with updated status

#### Scenario: Soft-deleted memory is not retrieved
- **WHEN** a search is executed
- **THEN** memories with status disabled are not included in results
- **AND** effectiveness recall events do not count disabled memories

### Requirement: Hard-delete memory command
The system SHALL provide an option to permanently delete memories.

#### Scenario: User hard-deletes a memory
- **WHEN** user invokes forget command with a valid memory ID and force flag
- **THEN** the memory is physically removed from the database
- **AND** the command returns success confirmation

#### Scenario: Hard-delete without confirmation fails
- **WHEN** user invokes forget command with force flag but without explicit confirm
- **THEN** the command is rejected with guidance for safe execution

### Requirement: Forget emits effectiveness event
The system SHALL record forget operations in the effectiveness pipeline.

#### Scenario: Forget operation emits event
- **WHEN** user successfully executes forget (soft or hard)
- **THEN** the system records an event for audit purposes
