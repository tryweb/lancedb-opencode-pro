# Design: Feedback-Driven Ranking

## Decision Table

| Decision | Choice | Why | Trade-off |
|----------|--------|-----|-----------|
| **Runtime surface** | internal-api | Improves existing search/recall - no new entrypoint needed | N/A |
| **Entrypoint** | `store.ts:search()` | All retrieval goes through this method | None - centralized |
| **Data model** | Query feedback from existing `effectiveness_events` table | Reuses existing infrastructure | Additional query overhead |
| **Feedback window** | Last 30 days | Balances relevance vs. staleness | May miss older patterns |
| **Failure handling** | Graceful fallback to neutral factor (1.0) | Prevents score distortion | Less adaptive when no feedback |

## Current Scoring Formula

```
score = rrfScore * recencyFactor * importanceFactor * scopeFactor
```

Where:
- `rrfScore` = Reciprocal Rank Fusion (vector + BM25)
- `recencyFactor` = time decay based on `recencyHalfLifeHours`
- `importanceFactor` = 1 + importanceWeight * staticImportance
- `scopeFactor` = globalDiscountFactor for global scope

## New Scoring Formula

```
score = rrfScore * recencyFactor * importanceFactor * scopeFactor * feedbackFactor
```

Where:
- `feedbackFactor` = 1 + feedbackWeight * (helpfulRate - 0.5) * 2 - wrongPenalty

### Feedback Factor Calculation

For each memory, compute:
1. **helpfulRate** = helpfulCount / (helpfulCount + unhelpfulCount)
   - Range: 0.0 to 1.0
   - If no feedback: use neutral 0.5
2. **wrongCount** = count of `feedbackType = "wrong"`
   - Applied as penalty: wrongPenalty = min(0.3, wrongCount * 0.1)
3. **feedbackFactor**:
   - If helpfulRate > 0.7 and wrongCount = 0: boost (factor > 1)
   - If helpfulRate < 0.3 or wrongCount > 2: penalize (factor < 1)
   - Otherwise: neutral (factor ≈ 1)

### Example Values

| helpfulRate | wrongCount | feedbackFactor |
|-------------|------------|-----------------|
| 1.0 (100%) | 0 | 1.4 (40% boost) |
| 0.8 (80%) | 0 | 1.24 (24% boost) |
| 0.5 (50%) | 0 | 1.0 (neutral) |
| 0.2 (20%) | 0 | 0.76 (24% penalty) |
| 0.0 (0%) | 3 | 0.4 (60% penalty) |

## Configuration

Add to `RetrievalConfig`:

```typescript
interface RetrievalConfig {
  // ... existing fields
  feedbackWeight: number;  // 0.0 = disabled, default 0.3
}
```

Config options:
- `LANCEDB_OPENCODE_PRO_FEEDBACK_WEIGHT` (env)
- `retrieval.feedbackWeight` (config file)
- Default: 0.3 (moderate influence)
- Range: 0.0 to 1.0

## Operability

### Trigger Path
1. User marks memory as useful/wrong via `memory_feedback_useful` or `memory_feedback_wrong`
2. Feedback stored in `effectiveness_events` table
3. Next recall/search queries feedback history for each memory
4. Feedback factor applied to scoring

### Expected Visible Output
- Memories with positive feedback rank higher in results
- Memories with negative feedback rank lower
- No visible UI change - only retrieval quality improvement

### Misconfiguration
- If `feedbackWeight = 0`: completely disabled, uses old formula
- If no feedback exists for any memory: neutral factor (1.0) for all
- If feedback query fails: log warning, use neutral factor

## Observability

1. **Score breakdown**: Add debug logging showing feedback factor contribution
2. **Metrics**: Track average feedback factor in search results
3. **KPI correlation**: Monitor if helpful rate improves after deployment

## Implementation Notes

### Query Optimization
- Feedback query should be cached per scope refresh
- Only query feedback for memories in the current candidate set
- Use indexed columns: `memoryId`, `type = 'feedback'`, `timestamp`

### Backward Compatibility
- Default `feedbackWeight = 0` maintains exact current behavior
- Users can opt-in by setting positive value
