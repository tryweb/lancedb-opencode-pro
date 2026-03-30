## 1. Retry-to-Success Rate

- [x] 1.1 Add `calculateRetryToSuccessRate()` method to `MemoryStore` class
- [x] 1.2 Implement time-range filtering for episodic tasks
- [x] 1.3 Count tasks with state=success that have retryAttempts
- [x] 1.4 Return rate with sample count and status

## 2. Memory Lift Calculation

- [x] 2.1 Add `taskUsedRecall()` helper to detect recall usage
- [x] 2.2 Add `calculateMemoryLift()` method to `MemoryStore` class
- [x] 2.3 Group tasks by recall usage status
- [x] 2.4 Calculate lift = (rate_with - rate_without) / rate_without
- [x] 2.5 Return lift with sample counts for both groups

## 3. KPI Tool Interface

- [x] 3.1 Add `memory_kpi` tool definition to `src/index.ts`
- [x] 3.2 Implement tool args schema (days: 1-365, scope: optional)
- [x] 3.3 Wire tool to aggregation layer
- [x] 3.4 Format output as structured JSON

## 4. Testing

- [x] 4.1 Add unit tests for retry-to-success calculation
- [x] 4.2 Add unit tests for memory lift calculation
- [x] 4.3 Add edge case tests (insufficient data, no failures)

## 5. Documentation

- [x] 5.1 Update `docs/ADVANCED_CONFIG.md` with KPI documentation
- [x] 5.2 Add metric formulas and interpretation guide
- [x] 5.3 Update `CHANGELOG.md` with new tool entry

## Verification Matrix

| Requirement | Unit | Integration | E2E | Required to release |
|---|---|---|---|---|
| R1: Retry-to-success rate | ✅ | ✅ | n/a | yes |
| R2: Memory lift | ✅ | ✅ | n/a | yes |
| R3: KPI query tool | ✅ | ✅ | n/a | yes |
