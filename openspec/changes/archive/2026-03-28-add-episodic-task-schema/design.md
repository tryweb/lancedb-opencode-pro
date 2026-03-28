## Context

The existing memory system captures individual events (memory capture, recall, feedback) but lacks structured representation of task-level execution. The backlog identifies BL-003 as foundational for episodic learning—without task episode schema, we cannot capture, classify, or learn from task execution patterns.

## Goals / Non-Goals

**Goals:**
- Define EpisodicTaskRecord schema with essential fields
- Support task states: pending, running, success, failed, timeout
- Support failure classification taxonomy

**Non-Goals:**
- Implementing actual episode capture logic (deferred to separate change)
- Multi-task orchestration
- Complex task dependency graphs

## Decisions

### Decision: Separate Table vs Extended MemoryRecord
Use separate `episodic_tasks` table rather than extending MemoryRecord.

**Rationale:** Task episodes have different lifecycle and query patterns than memories. Separation enables independent scaling and querying.

### Decision: Failure Taxonomy Categories
Define failure types: syntax, runtime, logic, resource, unknown.

**Rationale:** Standardized taxonomy enables pattern learning across similar failures. Categories map to common development error types.

### Decision: Lazy Schema Initialization
Initialize episodic_tasks table on first use, not at provider init.

**Rationale:** Reduces startup overhead if episodic features aren't used. Backward compatible with existing deployments.

## Risks / Trade-offs

- [Risk] Schema evolution complexity → **Mitigation**: Version field in record, forward-compatible additions
- [Risk] Query performance with large episode volumes → **Mitigation**: Index on task state and timestamp
- [Risk] Integration with existing events → **Mitigation**: Reference existing sessionID for correlation
