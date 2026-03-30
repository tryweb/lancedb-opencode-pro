# Proposal: Feedback-Driven Ranking

## Backlog Item

- **ID**: BL-038
- **Title**: Feedback-driven ranking / routing weights
- **Priority**: P0

## Problem Statement

Currently, memory retrieval ranking is based on:
1. **Vector similarity** (semantic relevance)
2. **BM25 lexical matching** (keyword relevance)
3. **Recency boost** (time decay)
4. **Static importance** (set at capture time)
5. **Scope factor** (global discount)

However, **user feedback** (helpful/wrong) is only tracked for statistics/dashboard purposes but is **not used to influence retrieval rankings**. This means:

- Memories that users consistently mark as "useful" do not get prioritized
- Memories that users mark as "wrong" continue to be injected at the same priority
- The system cannot learn from user corrections to improve future retrieval

## Why Now

1. **BL-030 and BL-031 completed**: Dashboard and KPI tools are in place to measure feedback effectiveness
2. **Immediate value**: Feedback-driven ranking directly improves the core retrieval quality
3. **Foundation for BL-039**: Task-type aware injection policy will build on this feedback mechanism
4. **Low risk**: Feedback is already being captured - we just need to use it

## Scope

### In Scope
- Calculate per-memory feedback score from `effectiveness_events` (helpful/wrong counts)
- Add feedback factor to retrieval scoring formula
- Add configuration option for feedback weight
- Wire up in auto-recall and manual search

### Out of Scope
- Task-type aware injection (BL-039 - separate change)
- Cross-memory pattern learning (future work)
- Feedback prediction (future work)

## Impacted Modules

| Module | Changes |
|--------|---------|
| `src/store.ts` | Add feedback factor calculation in `search()` |
| `src/types.ts` | Add feedback scoring types |
| `src/config.ts` | Add `feedbackWeight` configuration |
| `src/index.ts` | Pass feedback weight to search, wire config |

## Release Impact

- **Type**: Internal-only feature (plugin enhancement)
- **Changelog class**: `internal-only` - not exposed as separate user tool, but improves recall quality

## Risks

1. **Cold start**: New memories have no feedback history - will use neutral factor (1.0)
2. **Feedback sparsity**: Users may not provide much feedback - graceful fallback to static importance
3. **Oscillation**: Memory scores may change frequently - acceptable as it reflects user preferences

## Acceptance Criteria

1. Feedback from `memory_feedback_useful` and `memory_feedback_wrong` affects memory ranking
2. Configuration option `feedbackWeight` controls feedback influence (0 = disabled, default = 0.3)
3. New memories without feedback history get neutral score factor
4. Improvement measurable via existing KPI tools (helpful rate)
