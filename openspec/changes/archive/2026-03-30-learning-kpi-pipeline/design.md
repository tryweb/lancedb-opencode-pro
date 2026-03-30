## Context

The episodic task system records retry attempts, recovery strategies, and success patterns. However, there's no aggregation layer to calculate meaningful KPIs from this data. Operators need:
1. **Retry-to-success rate**: How often do failed tasks eventually succeed through retries?
2. **Memory lift**: Does using memory recall improve task success rates?

These metrics enable evidence-based decisions about memory system configuration.

## Goals / Non-Goals

**Goals:**
- Calculate retry-to-success rate from episodic task records
- Calculate memory lift by comparing success rates with/without recall
- Provide optional `memory_kpi` tool for querying metrics
- Document metric formulas and interpretation

**Non-Goals:**
- Real-time metrics streaming
- Alerting on threshold violations
- External dashboard integration (Grafana, etc.)

## Decisions

### Decision: Runtime Surface
**Choice:** `opencode-tool` (optional) + documentation (primary)

**Rationale:** BL-031 specifies "Docs + optional plugin tool". Documentation is primary deliverable; tool is secondary.

### Decision: Data Model
**No schema changes.** Uses existing `episodic_tasks` table.

**Rationale:** All required data is already in `retryAttemptsJson`, `validationOutcomesJson`, and `state` fields.

### Decision: Retry-to-Success Formula
```
retry_to_success_rate = (tasks with state=success after retries) / (total failed tasks)
```

**Rationale:** Simple, interpretable. Measures learning effectiveness.

### Decision: Lift Metric Formula
```
lift = (success_rate_with_recall - success_rate_without_recall) / success_rate_without_recall
```

**Rationale:** Standard lift calculation. Requires grouping tasks by whether recall was used.

### Decision: Time Range Support
Support `days` parameter (default 30) for metric calculation.

**Rationale:** Consistent with other tools (memory_dashboard, memory_what_did_you_learn).

## Risks / Trade-offs

- [Risk] Insufficient data for meaningful metrics → **Mitigation**: Minimum sample threshold (5+ tasks)
- [Risk] Lift metric requires recall-used flag not in current schema → **Mitigation**: Infer from validationOutcomesJson or add metadata field
- [Risk] Metrics feel abstract to users → **Mitigation**: Clear documentation with examples

## Migration Plan

No migration required. All queries are additive.

## Open Questions

1. How to determine if a task used memory recall?
   - **Resolution**: Check validationOutcomesJson for recall-related entries or add metadata field

2. Should KPI tool return time-series data or just current snapshot?
   - **Resolution**: Current snapshot first. Time-series can be added later.
