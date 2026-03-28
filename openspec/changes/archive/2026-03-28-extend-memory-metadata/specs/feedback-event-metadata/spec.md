# feedback-event-metadata Specification

## Purpose
Extend FeedbackEvent schema with additional fields for better tracking and attribution.

## ADDED Requirements

### Requirement: Source session tracking
The system SHALL support optional sourceSessionId field on FeedbackEvent.

#### Scenario: Feedback with source session
- **WHEN** a feedback event is created with sourceSessionId
- **THEN** the sourceSessionId is stored for audit

### Requirement: Confidence delta tracking
The system SHALL support optional confidenceDelta field to track how feedback affects memory confidence.

#### Scenario: Feedback with confidence adjustment
- **WHEN** a user marks a memory as wrong
- **THEN** the feedback event may include confidenceDelta
- **AND** downstream can adjust memory confidence

### Requirement: Related memory reference
The system SHALL support optional relatedMemoryId field on FeedbackEvent.

#### Scenario: Feedback linked to memory
- **WHEN** feedback is created for a specific memory
- **THEN** the relatedMemoryId references the target memory

### Requirement: Context field
The system SHALL support optional context field for additional feedback context.

#### Scenario: Feedback with context
- **WHEN** feedback is created with context data
- **THEN** the context is stored as JSON
- **AND** the context is available in effectiveness summaries
