## 1. Config and Types

- [x] 1.1 Add `dedup.writeThreshold`, `dedup.consolidateThreshold`, and `dedup.enabled` to `MemoryRuntimeConfig` interface in `src/types.ts`
- [x] 1.2 Add `duplicate-similarity` and `duplicate-exact` to `CaptureSkipReason` type in `src/types.ts`
- [x] 1.3 Add dedup config resolution in `src/config.ts`: read `dedup` from raw config, resolve `writeThreshold`, `consolidateThreshold`, and `enabled` with env-var precedence, clamp thresholds to `[0.0, 1.0]`, set safe defaults (`writeThreshold: 0.92`, `consolidateThreshold: 0.95`, `enabled: true`)

## 2. Store Layer — Consolidation Method (Soft Delete)

- [x] 2.1 Add `consolidateDuplicates(scope: string, threshold: number): Promise<{ mergedPairs: number; updatedRecords: number; skippedRecords: number }>` to `MemoryStore` class in `src/store.ts`
  - Scope-internal two-pass: first pass computes all-pair cosine similarity >= threshold (using `fastCosine` with pre-computed norms from scopeCache), second pass soft-deletes older records and updates newer records
  - Soft delete: set `metadataJson.status = "merged"` and `metadataJson.mergedInto = "<newer id>"` on the older record (NOT physical deletion)
  - Update newer record: set `metadataJson.mergedFrom = "<older id>"`
  - Must skip if older record already has `status === "merged"` (already processed)
  - Must skip records with `lastRecalled` within 5 minutes
  - Invalidate scope cache after all changes
  - Return operation metrics
- [x] 2.2 Filter merged records from `store.search()`: add `WHERE metadataJson.status != "merged"` clause so `memory_search` and recall automatically exclude merged records

## 3. Capture Pipeline — Dedup Flagging

- [x] 3.1 In `flushAutoCapture()` in `src/index.ts`, after `embedder.embed()` succeeds and before `store.put()`: call `store.search()` with `queryVector: vector`, `scopes: [activeScope]`, `limit: 1`, `vectorWeight: 1.0`, `bm25Weight: 0.0`, `minScore: 0.0`
- [x] 3.2 If `searchResults[0].score >= state.config.dedup.writeThreshold`: set `isPotentialDuplicate = true` and `duplicateOf = searchResults[0].record.id`; else `isPotentialDuplicate = false`, `duplicateOf = null`
- [x] 3.3 Pass `isPotentialDuplicate` and `duplicateOf` into `metadataJson` when calling `store.put()`
- [x] 3.4 When `dedup.enabled` is `false`: skip similarity check, write with `isPotentialDuplicate: false`
- [x] 3.5 When embedder fails or returns empty vector: skip similarity check, write with `isPotentialDuplicate: false` (graceful degradation)
- [x] 3.6 When scope has 0 records: skip similarity check, write with `isPotentialDuplicate: false`

## 4. Consolidation Trigger — Session Hook + Tool

- [x] 4.1 In `session.compacted` event handler in `src/index.ts`: after `flushAutoCapture()` completes, if `dedup.enabled` is `true`, call `store.consolidateDuplicates(activeScope, dedup.consolidateThreshold)` asynchronously (do not await, fire-and-forget)
- [x] 4.2 Add `memory_consolidate` tool in `src/index.ts`: args `{ scope: string, confirm: boolean }`, requires `confirm === true`, calls `store.consolidateDuplicates(scope, dedup.consolidateThreshold)`, returns `{ mergedPairs, updatedRecords, skippedRecords, scope }`
- [x] 4.3 Add `consolidateAllScopes()` variant that consolidates all known scopes (global + all project scopes from project registry). Used by external cron job for comprehensive daily cleanup.
- [x] 4.4 Document external cron usage in `docs/operations.md`: example cron script that calls `memory_consolidate` for global scope and per-project scopes daily at 03:00 UTC

## 5. Configuration Tests

- [x] 5.1 Test: default dedup thresholds are `0.92` and `0.95` when config is empty
- [x] 5.2 Test: env vars override sidecar config
- [x] 5.3 Test: invalid threshold values are clamped to `[0.0, 1.0]`

## 6. Store Consolidation Tests

- [x] 6.1 Test: `consolidateDuplicates` returns `{ mergedPairs: 0, deletedRecords: 0, skippedRecords: 0 }` when scope is empty
- [x] 6.2 Test: `consolidateDuplicates` merges two memories with cosine >= 0.95, older is deleted, newer retains `mergedFrom` in metadata
- [x] 6.3 Test: `consolidateDuplicates` skips records recalled within last 5 minutes
- [x] 6.4 Test: `consolidateDuplicates` is idempotent (second call returns 0)

## 7. Capture Dedup Flagging Tests

- [ ] 7.1 Test: second memory with >0.92 similarity to first is written with `isPotentialDuplicate: true` and `duplicateOf` set
- [ ] 7.2 Test: memory with <0.92 similarity is written with `isPotentialDuplicate: false`
- [ ] 7.3 Test: when `dedup.enabled` is `false`, no similarity check is performed and memory is written with `isPotentialDuplicate: false`
- [x] 7.4 Test: `memory_consolidate` tool returns error when `confirm !== true`
- [x] 7.5 Test: `memory_consolidate` tool calls `consolidateDuplicates` and returns metrics when `confirm === true`

## 8. memory_search Duplicate Marker Display

- [x] 8.1 In `memory_search` tool formatter in `src/index.ts`: parse `metadataJson.isPotentialDuplicate` from each result; if `true`, append `(duplicate)` to the formatted output line after the ID
- [x] 8.2 Ensure raw result object includes `isPotentialDuplicate: boolean` and `duplicateOf: string | null` fields in the return value (not just formatted string)
- [x] 8.3 Test: `memory_search` result with `isPotentialDuplicate: true` shows `(duplicate)` marker in output
- [x] 8.4 Test: `memory_search` result with `isPotentialDuplicate: false` or absent shows no marker
- [x] 8.5 Test: `memory_search` does not return records with `metadataJson.status === "merged"`

## 9. Effectiveness Summary — Duplicate Metrics

- [x] 9.1 In `store.summarizeEvents()` in `src/store.ts`: count capture events with `skipReason === "duplicate-similarity"` and store count as `flaggedCount`; count records with `metadataJson.status === "merged"` as `consolidatedCount`
- [x] 9.2 Add `duplicates: { flaggedCount: number, consolidatedCount: number }` to `EffectivenessSummary` interface in `src/types.ts`
- [x] 9.3 Test: `memory_effectiveness` returns `duplicates.flaggedCount` reflecting `duplicate-similarity` capture events
- [x] 9.4 Test: `memory_effectiveness` returns `duplicates.consolidatedCount` reflecting merged records in scope

## 10. pruneScope — Priority Deletion of Flagged Records

- [x] 10.1 In `store.pruneScope()` in `src/store.ts`: when selecting records to delete to meet `maxEntriesPerScope`, prioritize records with `metadataJson.isPotentialDuplicate === true` over unflagged records of similar or older timestamp
- [x] 10.2 Within flagged records, use timestamp ordering (oldest first) to decide deletion order
- [x] 10.3 Test: when scope has N flagged duplicates and M unflagged records, and `maxEntriesPerScope = N + M - 1`, only the newest flagged duplicate is retained
- [x] 10.4 Test: unflagged records are only deleted after all flagged records with older timestamps are removed
