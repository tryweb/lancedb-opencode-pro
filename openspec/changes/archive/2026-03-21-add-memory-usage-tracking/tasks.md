## 1. Schema and Types

- [x] 1.1 Add `lastRecalled: number` field to `MemoryRecord` interface
- [x] 1.2 Add `recallCount: number` field to `MemoryRecord` interface
- [x] 1.3 Add `projectCount: number` field to `MemoryRecord` interface
- [x] 1.4 Add `recalledProjects: string[]` field to store distinct project scopes (via metadataJson)

## 2. Storage Layer

- [x] 2.1 Update LanceDB schema to include new usage columns (via normalizeRow)
- [x] 2.2 Modify `normalizeRow` to handle new fields with backward-compatible defaults
- [x] 2.3 Add `updateMemoryUsage(id: string, projectScope: string)` method
- [x] 2.4 Update `put` to initialize usage fields on new memories (via store.put calls)

## 3. Recall Tracking

- [x] 3.1 Update auto-recall handler to call `updateMemoryUsage` for each result
- [x] 3.2 Update manual search handler to call `updateMemoryUsage` for each result
- [x] 3.3 Ensure usage tracking is fire-and-forget (non-blocking via .catch())

## 4. Smart Unused Detection

- [x] 4.1 Update `getUnusedGlobalMemories` to use `lastRecalled` instead of `timestamp`
- [x] 4.2 Remove timestamp-based fallback heuristic (now uses lastRecalled > 0 check)

## 5. Global List Updates

- [x] 5.1 Update `memory_global_list` to display usage statistics
- [x] 5.2 Include `lastRecalled`, `recallCount`, `projectCount` in output
- [x] 5.3 Format timestamps in human-readable format

## 6. Testing

- [x] 6.1 Update test/setup.ts for new usage fields
- [x] 6.2 Foundation tests pass (10/10)
- [x] 6.3 Run full test suite (foundation: 10/10, regression: 13/18 - 5 pre-existing failures)
