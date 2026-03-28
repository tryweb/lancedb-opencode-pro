## Context

The existing MemoryRecord schema contains: id, content, scope, timestamp, importance, embedding, vector. The FeedbackEvent schema tracks capture/recall/feedback events. Future features (preference learning, episodic tasks, citation tracking) require additional metadata fields. The backlog identifies BL-001, BL-002 as foundational infrastructure changes.

## Goals / Non-Goals

**Goals:**
- Extend MemoryRecord with userId, teamId, sourceSessionId, confidence, tags[], status, parentId
- Extend FeedbackEvent with sourceSessionId, confidenceDelta, relatedMemoryId, context
- Implement schema migration mechanism for backward compatibility

**Non-Goals:**
- Multi-user authentication/authorization (deferred)
- Complex relationship traversal (parent-child beyond single level)

## Decisions

### Decision: Field Addition Strategy
Add new columns rather than modifying existing ones. Existing queries continue to work.

**Rationale:** LanceDB supports schema evolution. Adding columns is backward compatible.

### Decision: Migration Timing
Run migrations on provider initialization, not on each operation.

**Rationale:** Single-point check is simpler, avoids per-operation overhead, easier to reason about.

### Decision: Optional Fields
All new fields are optional (nullable). Default null for new records.

**Rationale:** Backward compatibility—existing memories continue to work without requiring migration of old records.

## Risks / Trade-offs

- [Risk] Schema version confusion → **Mitigation**: Track schemaVersion explicitly, document upgrade path
- [Risk] Query performance with new nullable filters → **Mitigation**: Add indexes only if needed, measure first
- [Risk] Feedback events without relatedMemoryId → **Mitigation**: Allow null, treat as unlinked feedback
