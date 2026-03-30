## Why

Users lack visibility into learning effectiveness trends over time. While `memory_what_did_you_learn` shows recent captures and `memory_effectiveness` provides point-in-time metrics, there's no aggregated weekly view that connects learning activity to outcome trends. This leaves users blind to whether their memory system is improving and what adjustments might help.

## What Changes

- Add `memory_dashboard` tool providing aggregated weekly learning summary
- Combine capture, recall, and feedback metrics into a unified dashboard view
- Add trend indicators showing week-over-week changes
- Include actionable insights for memory quality optimization

## Capabilities

### New Capabilities

- `learning-dashboard`: Aggregated weekly summary tool combining capture/recall/feedback metrics with trend indicators

### Modified Capabilities

- `memory-management-commands`: Extends with new `memory_dashboard` tool

## Impact

- New tool implementation in `src/index.ts` (plugin surface)
- Reuses existing `summarizeEvents()` from `src/store.ts`
- No schema changes required (reads from existing `effectiveness_events` table)
- Documentation update for new tool