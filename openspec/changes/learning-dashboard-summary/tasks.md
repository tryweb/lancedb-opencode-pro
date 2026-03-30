## 1. Data Aggregation Layer

- [ ] 1.1 Add `getWeeklyEffectivenessSummary()` method to `MemoryStore` class
- [ ] 1.2 Implement time-range filtering for events (current period vs previous period)
- [ ] 1.3 Calculate capture metrics aggregation (total, stored, skipped, success rate)
- [ ] 1.4 Calculate recall metrics aggregation (requests, injected, hit rate, manual rescue ratio)
- [ ] 1.5 Calculate feedback metrics aggregation (missing, wrong, useful, helpful rate, false rates)

## 2. Trend Calculation

- [ ] 2.1 Add trend calculation utility comparing current vs previous period
- [ ] 2.2 Implement percentage change with direction (improving/stable/declining)
- [ ] 2.3 Add minimum sample threshold check (5+ events in both periods)
- [ ] 2.4 Return "insufficient-data" when threshold not met

## 3. Insight Generation

- [ ] 3.1 Add rule-based insight generator function
- [ ] 3.2 Implement low recall hit rate insight (< 50%)
- [ ] 3.3 Implement high skip rate insight (> 50%)
- [ ] 3.4 Implement low helpful rate insight (< 70%)
- [ ] 3.5 Return healthy status when all metrics in range

## 4. Memory Category Integration

- [ ] 4.1 Integrate `listSince()` for recent memory retrieval
- [ ] 4.2 Aggregate memory counts by category
- [ ] 4.3 Format sample memories per category (max 3)

## 5. Tool Interface

- [ ] 5.1 Add `memory_dashboard` tool definition to `src/index.ts`
- [ ] 5.2 Implement tool args schema (days: 1-90, scope: optional)
- [ ] 5.3 Wire tool to aggregation layer
- [ ] 5.4 Format output as structured JSON

## 6. Testing

- [ ] 6.1 Add unit tests for weekly summary calculation
- [ ] 6.2 Add unit tests for trend calculation logic
- [ ] 6.3 Add unit tests for insight generation rules
- [ ] 6.4 Add integration test for `memory_dashboard` tool invocation
- [ ] 6.5 Add edge case tests (empty events, single period)

## 7. Documentation

- [ ] 7.1 Update `docs/ADVANCED_CONFIG.md` with `memory_dashboard` tool documentation
- [ ] 7.2 Update `README.md` tool list with `memory_dashboard`
- [ ] 7.3 Update `CHANGELOG.md` with new tool entry

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