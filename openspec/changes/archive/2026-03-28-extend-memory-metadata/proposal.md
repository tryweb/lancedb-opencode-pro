## Why

Current MemoryRecord and FeedbackEvent schemas lack fields needed for preference learning, episodic task records, and advanced memory governance. Extending metadata now enables future features (preference aggregation, conflict resolution, citation tracking) without schema migrations later.

## What Changes

- Extend MemoryRecord schema with: userId, teamId, sourceSessionId, confidence, tags[], status, parentId
- Extend FeedbackEvent schema with: sourceSessionId, confidenceDelta, relatedMemoryId, context
- Add schema migration mechanism for backward compatibility

## Capabilities

### New Capabilities

- `memory-record-metadata`: Extended MemoryRecord schema with user/team identification, source tracking, confidence scoring, tagging, soft-delete status, and parent-child relationships
- `feedback-event-metadata`: Extended FeedbackEvent schema with source session tracking, confidence delta, related memory reference, and contextual data
- `memory-schema-migration`: Schema versioning and migration mechanism for backward compatibility

### Modified Capabilities

- `memory-auto-capture-and-recall`: May need to emit new metadata fields during capture
- `memory-effectiveness-evaluation`: May reference new FeedbackEvent fields

## Impact

- Schema changes to LanceDB tables (add columns, not modify existing)
- Migration logic in provider initialization
- Potential impact on existing queries (should be backward compatible)
