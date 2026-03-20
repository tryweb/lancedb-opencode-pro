## 1. Schema And Storage

- [x] 1.1 Add `source` field to RecallEvent type and update events table bootstrap row in store.ts.
- [x] 1.2 Update putEvent and normalizeEventRow to handle the new source field with backward-compatible defaults.

## 2. Event Emission

- [x] 2.1 Add explicit `source: "system-transform"` to the recall event emitted in the system-transform hook.
- [x] 2.2 Emit a recall event from the memory_search tool with `source: "manual-search"` and `injected: false`.

## 3. Summary Split

- [x] 3.1 Extend EffectivenessSummary.recall with auto and manual sub-structures and a manualRescueRatio field.
- [x] 3.2 Update summarizeEvents to aggregate auto and manual recall counters separately.

## 4. Tests

- [x] 4.1 Add foundation test verifying that auto and manual recall events are stored and scoped correctly.
- [x] 4.2 Add regression test verifying that memory_search emits a manual-search recall event and that the summary splits auto/manual correctly.

## 5. Docs

- [x] 5.1 Update README.md example output and interpretation guidance for the new recall sub-structures.
- [x] 5.2 Update docs/operations.md proxy metrics table to mark manual rescue rate as instrumented.
- [x] 5.3 Update docs/release-readiness.md evidence mapping for the new recall split.
