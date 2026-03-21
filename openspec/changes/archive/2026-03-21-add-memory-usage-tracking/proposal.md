## Why

The cross-project memory scope feature (`add-cross-project-memory-scope`) provides tools for managing global-scoped memories, but lacks usage tracking. Without knowing how often each global memory is recalled, the system cannot effectively identify unused memories for demotion suggestions, nor provide users with insights about which knowledge is actually being utilized.

## What Changes

### New Capabilities

1. **Usage statistics fields** — Add `lastRecalled`, `recallCount`, and `projectCount` fields to track each memory's usage history.

2. **Recall event tracking** — When a memory is recalled (either auto or manual), increment `recallCount` and update `lastRecalled` timestamp.

3. **Project tracking** — Track which distinct projects have recalled each global memory via `projectCount`.

4. **Statistics in global list** — `memory_global_list` displays usage statistics for each global memory.

5. **Smart unused detection** — Identify global memories not recalled within threshold, using actual recall events instead of timestamp heuristics.

## Impact

### Code Changes

- `src/types.ts`: Add usage statistics fields to `MemoryRecord`
- `src/store.ts`: Add methods to update usage stats during recall
- `src/index.ts`: Update recall handlers to track usage

### Behavior Changes

- `memory_global_list` output includes usage statistics
- Unused global detection uses actual recall data, not just timestamp

### Breaking Changes

- None. All changes are additive.
