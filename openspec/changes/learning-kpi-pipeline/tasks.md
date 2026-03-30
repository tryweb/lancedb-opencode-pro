## 1. Retry-to-Success Rate

- [ ] 1.1 Add `calculateRetryToSuccessRate()` method to `MemoryStore` class
- [ ] 1.2 Implement time-range filtering for episodic tasks
- [ ] 1.3 Count tasks with state=success that have retryAttempts
- [ ] 1.4 Return rate with sample count and status

## 2. Memory Lift Calculation

- [ ] 2.1 Add `taskUsedRecall()` helper to detect recall usage
- [ ] 2.2 Add `calculateMemoryLift()` method to `MemoryStore` class
- [ ] 2.3 Group tasks by recall usage status
- [ ] 2.4 Calculate lift = (rate_with - rate_without) / rate_without
- [ ] 2.5 Return lift with sample counts for both groups

## 3. KPI Tool Interface

- [ ] 3.1 Add `memory_kpi` tool definition to `src/index.ts`
- [ ] 3.2 Implement tool args schema (days: 1-365, scope: optional)
- [ ] 3.3 Wire tool to aggregation layer
- [ ] 3.4 Format output as structured JSON

## 4. Testing

- [ ] 4.1 Add unit tests for retry-to-success calculation
- [ ] 4.2 Add unit tests for memory lift calculation
- [ ] 4.3 Add edge case tests (insufficient data, no failures)

## 5. Documentation

- [ ] 5.1 Update `docs/ADVANCED_CONFIG.md` with KPI documentation
- [ ] 5.2 Add metric formulas and interpretation guide
- [ ] 5.3 Update `CHANGELOG.md` with new tool entry

## Verification Matrix

| Requirement | Unit | Integration | E2E | Required to release |
|---|---|---|---|---|
| R1: Retry-to-success rate | ✅ | ✅ | n/a | yes |
| R2: Memory lift | ✅ | ✅ | n/a | yes |
| R3: KPI query tool | ✅ | ✅ | n/a | yes |
