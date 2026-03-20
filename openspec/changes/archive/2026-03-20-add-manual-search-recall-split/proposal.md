## Why

The `memory_search` tool currently does not emit any recall event, so operators cannot distinguish manual search activity from automatic recall injection. If manual-search events are added without splitting, the existing `recall.hitRate` and `recall.injectionRate` become misleading: manual searches inflate hitRate (users search with intent, so results are almost always found) and deflate injectionRate (manual searches are never injected into the system prompt). We need to emit manual-search events and split recall metrics into auto and manual sub-structures so each retains clear semantics.

## What Changes

- Add a `source` field to `RecallEvent` to distinguish `"system-transform"` from `"manual-search"`.
- Emit a recall event from the `memory_search` tool with `source: "manual-search"` and `injected: false`.
- Split `EffectivenessSummary.recall` into `auto` and `manual` sub-structures while keeping top-level blended totals for backward compatibility.
- Update `summarizeEvents` to aggregate auto and manual recall counters separately.
- Add a computed `manualRescueRatio` that quantifies the manual memory rescue rate proxy metric.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `memory-effectiveness-evaluation`: Extend the recall event schema and effectiveness summary to distinguish auto-recall from manual-search activity.
- `memory-management-commands`: The `memory_search` command now emits a structured recall event for effectiveness tracking.

## Impact

- `src/types.ts`: RecallEvent gains `source` field; EffectivenessSummary.recall gains `auto` and `manual` sub-structures and `manualRescueRatio`.
- `src/store.ts`: Event bootstrap row, putEvent, normalizeEventRow, and summarizeEvents need adjustments.
- `src/index.ts`: memory_search tool emits a recall event; system-transform hook event includes explicit `source`.
- `test/`: Foundation and regression tests must cover auto/manual split and manual rescue ratio.
- `docs/`: operations.md, README.md, release-readiness.md, and VALIDATION_README.md must reflect the new summary shape.
