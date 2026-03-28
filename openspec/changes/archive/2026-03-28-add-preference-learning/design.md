## Context

Users express preferences implicitly through repeated patterns (always using TypeScript, prefers certain testing frameworks) but the system doesn't learn from these signals. The backlog identifies BL-005, BL-006, BL-008 as core preference learning capabilities. This change depends on metadata extensions from `extend-memory-metadata`.

## Goals / Non-Goals

**Goals:**
- Implement preference profile aggregation from memory content
- Implement conflict resolution rules (recency + directness priority)
- Implement scope precedence (project > global default)
- Implement preference-aware prompt injection

**Non-Goals:**
- Complex preference inference (beyond keyword/pattern matching)
- Preference learning from episodic tasks (deferred to BL-017)
- A/B testing framework (deferred to BL-033)

## Decisions

### Decision: Preference Signal Sources
Start with explicit preference markers in memory content (keywords, patterns) rather than ML-based inference.

**Rationale:** Simpler to implement, more predictable, easier to debug. Can add ML layer later.

### Decision: Conflict Resolution Priority
Recent signals (higher timestamp) override older ones. Direct user signals override inferred signals.

**Rationale:** Matches user intuition—latest preference should win. Direct signals are more trustworthy than inferences.

### Decision: Injection Strategy
Layered injection: preferences → decisions → success patterns, each with distinct context sections.

**Rationale:** Separation enables downstream to weight differently. Preferences are general, decisions are specific, success patterns are evidence.

## Risks / Trade-offs

- [Risk] Preference bloat → **Mitigation**: Limit stored preferences per scope, apply decay
- [Risk] Conflicting signals from different contexts → **Mitigation**: Scope precedence rules, conflict logging
- [Risk] Injection token bloat → **Mitigation**: Budget mode for injection, summarization fallback
