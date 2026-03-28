## Context

When tasks fail, the system should be able to suggest retry strategies based on historical evidence—not by reimplementing execution engine, but by providing intelligence hints. The backlog identifies BL-019 and BL-020 as the core retry/recovery evidence capabilities. This integrates with OpenCode/OMO events.

## Goals / Non-Goals

**Goals:**
- Track retry attempts and outcomes as evidence
- Suggest retry budgets based on task type history
- Recommend backoff/cooldown strategies
- Suggest fallback strategies after repeated failures

**Non-Goals:**
- Implementing retry execution (OMO responsibility)
- Complex retry policies
- Automatic recovery actions

## Decisions

### Decision: Evidence-Based Suggestions Only
Provide hints/suggestions, not direct execution control.

**Rationale:** Respects separation of concerns. OMO owns execution. Evidence layer provides intelligence.

### Decision: Reuse Episode Table
Store retry evidence in episodic_tasks table with additional fields.

**Rationale:** Avoids schema proliferation. Retry is a special case of task episode.

### Decision: Simple Budget Calculation
Calculate suggested budget = median(previous_attempts) + 1.

**Rationale:** Simple heuristic. More sophisticated models can be added later.

## Risks / Trade-offs

- [Risk] Suggestion quality → **Mitigation**: Confidence scoring, manual override option
- [Risk] Stale evidence → **Mitigation**: Age-based decay, minimum sample threshold
- [Risk] Integration complexity → **Mitigation**: Event-based integration with existing hooks
