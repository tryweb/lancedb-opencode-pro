## Context

The memory system currently provides two separate views for learning effectiveness:
1. `memory_what_did_you_learn` - Recent memory captures grouped by category
2. `memory_effectiveness` - Point-in-time effectiveness metrics (capture rate, recall hit rate, feedback ratios)

Users lack a unified weekly dashboard that combines these metrics with trend indicators. This makes it difficult to answer questions like "Is my memory system improving?" or "What should I focus on for better learning?"

## Goals / Non-Goals

**Goals:**
- Provide a unified weekly learning summary combining capture, recall, and feedback metrics
- Show week-over-week trend indicators (improving/stable/declining)
- Surface actionable insights for memory quality optimization
- Enable time-range filtering (7d, 14d, 30d)

**Non-Goals:**
- Real-time metrics dashboard (defer to future monitoring integration)
- Export to external dashboard tools (Grafana, etc.)
- Alerting or threshold-based notifications

## Decisions

### Decision: Runtime Surface
**Choice:** `opencode-tool` (plugin tool invoked by AI or user)

**Rationale:** Consistent with existing `memory_effectiveness` and `memory_what_did_you_learn` tools. Plugin surface is the established pattern for memory system observability.

**Trade-off:** User cannot access directly via CLI. Requires AI invocation context.

### Decision: Entrypoint
**File:** `src/index.ts`
**Symbol:** `memory_dashboard` tool

**Rationale:** All memory tools are registered in `src/index.ts` plugin definition. New tool follows same pattern.

### Decision: Data Model
**No schema changes.** Reuses existing `effectiveness_events` table.

**Rationale:** Weekly aggregation is computed at query time from existing event records. No new tables or columns needed.

### Decision: Trend Calculation
**Choice:** Compare current period to previous equivalent period (e.g., this week vs last week)

**Rationale:** Simple, interpretable trend indicator. Provides actionable feedback without complex statistical models.

**Trade-off:** No seasonality adjustment or long-term trend analysis.

### Decision: Insight Generation
**Choice:** Rule-based heuristics from effectiveness metrics

**Rationale:** Deterministic, explainable insights. Example: "Low recall hit rate suggests adding more specific queries" or "High skip rate indicates potential duplicate issues."

**Trade-off:** No ML-based insight generation.

## Risks / Trade-offs

- [Risk] Large event tables slow dashboard queries → **Mitigation**: Limit query time range (max 90 days), add pagination
- [Risk] Trend calculation noisy with few samples → **Mitigation**: Minimum sample threshold before showing trends
- [Risk] Insights feel generic or unhelpful → **Mitigation**: User feedback collection, iterate on insight rules

## Migration Plan

No migration required. All changes are additive:
1. Add new `memory_dashboard` tool
2. Add aggregation logic in `src/store.ts` (weekly summary calculation)
3. Document in Advanced Configuration guide

## Open Questions

1. Should `memory_dashboard` include memory counts by category (reusing `memory_what_did_you_learn` logic)?
   - **Resolution**: Yes, unified view is more valuable than separate calls. Dedup logic.

2. Should trends include visual formatting (ASCII charts)?
   - **Resolution**: Keep JSON output, allow AI to format. Preserve structured data for programmatic use.