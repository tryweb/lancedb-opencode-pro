## Context

Building on the episodic task schema, this change enables capturing task episodes and learning from them. The backlog identifies BL-014 through BL-018 as the core episodic learning capabilities. These enable the system to remember how similar tasks were solved.

## Goals / Non-Goals

**Goals:**
- Implement task episode capture on session events
- Parse validation outcomes (type/build/test)
- Classify failures using taxonomy
- Extract success patterns
- Implement similar task recall

**Non-Goals:**
- Automatic retry execution (just evidence/hints)
- Complex workflow orchestration
- ML-based pattern extraction (rule-based only for v1)

## Decisions

### Decision: Event-Based Capture
Trigger episode capture on OpenCode session events (session start, tool execution, session end).

**Rationale:** Matches existing event pipeline. No new infrastructure needed.

### Decision: Rule-Based Pattern Extraction
Extract patterns using keyword/structure matching rather than ML.

**Rationale:** Simpler to implement, more predictable, easier to debug. ML layer can be added later.

### Decision: Similarity Threshold for Recall
Only recall tasks with cosine similarity >= 0.85.

**Rationale:** Higher threshold reduces noise. Can be made configurable later.

## Risks / Trade-offs

- [Risk] Episode storage bloat → **Mitigation**: TTL or manual cleanup for old episodes
- [Risk] Pattern extraction false positives → **Mitigation**: Confidence threshold, manual review flag
- [Risk] Similar task recall overhead → **Mitigation**: Async background recall, cache results
