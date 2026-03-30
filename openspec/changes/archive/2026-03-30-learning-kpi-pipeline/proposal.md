## Why

The memory system has retry and recovery tools (`retry_budget_suggest`, `recovery_strategy_suggest`) but no aggregated KPI metrics to measure whether the episodic learning is actually improving task success rates. Operators cannot answer: "Is retry learning reducing failure rates?" or "Does using memory recall improve task outcomes vs not using it?"

## What Changes

- Add retry-to-success rate calculation from episodic task data
- Add memory "lift" metric comparing success rates with/without recall
- Add KPI documentation explaining metrics, formulas, and interpretation
- Add optional `memory_kpi` tool for querying aggregated metrics

## Capabilities

### New Capabilities

- `kpi-retry-success`: Retry-to-success rate calculation from episodic tasks (success after N retries)
- `kpi-memory-lift`: Memory lift metric comparing task success with recall vs without
- `kpi-query`: Optional plugin tool for querying KPI metrics with time range

### Modified Capabilities

- `episodic-task-schema`: May need metadata fields for KPI calculation (recall-used flag)

## Impact

- New aggregation logic in `src/store.ts`
- New optional `memory_kpi` tool in `src/index.ts`
- Documentation in `docs/ADVANCED_CONFIG.md`
- No schema changes required (uses existing episodic_tasks table)
