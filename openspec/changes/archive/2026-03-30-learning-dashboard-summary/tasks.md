## 1. Data Aggregation Layer

- [x] 1.1 Add `getWeeklyEffectivenessSummary()` method to `MemoryStore` class
- [x] 1.2 Implement time-range filtering for events (current period vs previous period)
- [x] 1.3 Calculate capture metrics aggregation (total, stored, skipped, success rate)
- [x] 1.4 Calculate recall metrics aggregation (requests, injected, hit rate, manual rescue ratio)
- [x] 1.5 Calculate feedback metrics aggregation (missing, wrong, useful, helpful rate, false rates)

## 2. Trend Calculation

- [x] 2.1 Add trend calculation utility comparing current vs previous period
- [x] 2.2 Implement percentage change with direction (improving/stable/declining)
- [x] 2.3 Add minimum sample threshold check (5+ events in both periods)
- [x] 2.4 Return "insufficient-data" when threshold not met

## 3. Insight Generation

- [x] 3.1 Add rule-based insight generator function
- [x] 3.2 Implement low recall hit rate insight (< 50%)
- [x] 3.3 Implement high skip rate insight (> 50%)
- [x] 3.4 Implement low helpful rate insight (< 70%)
- [x] 3.5 Return healthy status when all metrics in range

## 4. Memory Category Integration

- [x] 4.1 Integrate `listSince()` for recent memory retrieval
- [x] 4.2 Aggregate memory counts by category
- [x] 4.3 Format sample memories per category (max 3)

## 5. Tool Interface

- [x] 5.1 Add `memory_dashboard` tool definition to `src/index.ts`
- [x] 5.2 Implement tool args schema (days: 1-90, scope: optional)
- [x] 5.3 Wire tool to aggregation layer
- [x] 5.4 Format output as structured JSON

## 6. Testing

- [x] 6.1 Add unit tests for weekly summary calculation
- [x] 6.2 Add unit tests for trend calculation logic
- [x] 6.3 Add unit tests for insight generation rules
- [x] 6.4 Add integration test for `memory_dashboard` tool invocation
- [x] 6.5 Add edge case tests (empty events, single period)

## 7. Documentation

- [x] 7.1 Update `docs/ADVANCED_CONFIG.md` with `memory_dashboard` tool documentation
- [x] 7.2 Update `README.md` tool list with `memory_dashboard`
- [x] 7.3 Update `CHANGELOG.md` with new tool entry

## Verification Matrix

| Requirement | Unit | Integration | E2E | Required to release |
|---|---|---|---|---|
| R1: Dashboard tool invocation | ✅ | ✅ | n/a | yes |
| R2: Capture metrics aggregation | ✅ | ✅ | n/a | yes |
| R3: Recall metrics aggregation | ✅ | ✅ | n/a | yes |
| R4: Feedback metrics aggregation | ✅ | ✅ | n/a | yes |
| R5: Week-over-week trends | ✅ | ✅ | n/a | yes |
| R6: Actionable insights | ✅ | ✅ | n/a | yes |
| R7: Memory category breakdown | ✅ | ✅ | n/a | yes |
| R8: Minimum sample threshold | ✅ | ✅ | n/a | yes |