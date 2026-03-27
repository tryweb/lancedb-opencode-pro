## Why

The current memory system has no deduplication mechanism. When users ask the same question using different phrasing, or revisit the same topic across sessions, the system stores each occurrence as a separate memory entry with no similarity check. This causes storage bloat (memories that are semantically identical occupy multiple slots in `maxEntriesPerScope`), noisy recall results (multiple near-identical memories are returned and injected), and degraded capture/recall effectiveness metrics. The `openspec/changes/archive/2026-03-21-add-cross-project-memory-scope/design.md` explicitly listed deduplication as a non-goal at the time; this change addresses that gap now that the core memory pipeline is stable.

## What Changes

- **New capability `memory-similarity-dedup`**: After a capture candidate passes extraction and embedding, the system performs a scope-internal vector similarity search before writing. If the top similarity score >= 0.92, the memory is written with `isPotentialDuplicate: true` and `duplicateOf: <id>` metadata. Writing is never blocked—flagging only.
- **New capability `memory-consolidation`**: A consolidation routine that scope-internally merges memories with cosine similarity >= 0.95 using soft delete. Primary trigger: `session.compacted` hook (opportunistic). Backup trigger: external cron calling `memory_consolidate` tool daily.
- **Modified capability `memory-auto-capture-and-recall`**: The capture flow in `flushAutoCapture()` gains a new pre-write similarity check step. Two new `CaptureSkipReason` values are added for observability: `duplicate-similarity` (similarity >= 0.92) and `duplicate-exact` (MD5 hash collision).
- **New tool `memory_consolidate`**: A plugin tool to manually trigger consolidation for a given scope, for operators who want on-demand cleanup.
- No changes to `store.put()` semantics, search API, injection behavior, or schema version.

## Capabilities

### New Capabilities

- `memory-similarity-dedup`: Write-path similarity flagging. Scopes: project and global. Threshold: 0.92 cosine similarity. Implementation reuses existing `store.search()` with `vectorWeight=1.0, bm25Weight=0` and `limit=1`. No blocking—flags and writes.
- `memory-consolidation`: Background scope-internal deduplication. Threshold: 0.95 cosine similarity. Triggered by `session.compacted` hook or manual `memory_consolidate` tool call. Uses soft delete (older record marked `status: "merged"`, newer record receives `mergedFrom` reference). Merged records excluded from search results. Runs asynchronously; does not block capture or recall.
- `memory-consolidate-tool`: Plugin tool `memory_consolidate(scope, confirm)` for on-demand consolidation.
- `memory-search-dedup-display`: `memory_search` results display `(duplicate)` marker for records with `isPotentialDuplicate: true`. Raw result objects include `isPotentialDuplicate` and `duplicateOf` fields.

### Modified Capabilities

- `memory-auto-capture-and-recall`: New pre-write similarity check step in `flushAutoCapture()`. New skip reasons in capture events: `duplicate-similarity` and `duplicate-exact`. No requirement changes to existing scenarios.

## Impact

**Affected code:**
- `src/index.ts`: `flushAutoCapture()` gains similarity check before `store.put()`. New `consolidateScope()` function. New `memory_consolidate` tool.
- `src/store.ts`: New `consolidateDuplicates(scope, threshold)` method. No changes to existing `put()`, `search()`, `pruneScope()` signatures.
- `src/types.ts`: `CaptureSkipReason` enum gains `duplicate-similarity` and `duplicate-exact`. `MemoryRecord` metadata schema unchanged (uses `metadataJson`).
- `src/utils.ts`: No changes.
- `src/extract.ts`: No changes.

**Configuration:**
- `dedup.writeThreshold` (env: `LANCEDB_OPENCODE_PRO_DEDUP_WRITE_THRESHOLD`, default: `0.92`)
- `dedup.consolidateThreshold` (env: `LANCEDB_OPENCODE_PRO_DEDUP_CONSOLIDATE_THRESHOLD`, default: `0.95`)
- `dedup.enabled` (env: `LANCEDB_OPENCODE_PRO_DEDUP_ENABLED`, default: `true`)

**No external API or CLI changes.** No breaking changes to existing tool interfaces.
