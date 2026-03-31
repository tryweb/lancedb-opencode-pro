# BL-044: Duplicate Consolidation Scalability Refactor

## Why

The current `consolidateDuplicates` implementation uses an O(N²) double loop to compare all memory pairs within a scope. For large scopes (e.g., `maxEntriesPerScope=3000`), this generates ~4.5 million comparisons, which blocks the Node.js event loop for unacceptable durations (seconds to tens of seconds). This violates the plugin's surface contract: non-blocking background operations that must not degrade interactive response times.

**Impact**: When `session.compacted` triggers consolidation on a scope with many memories, the plugin becomes unresponsive, affecting all tool invocations during that period. This is a **critical scalability issue** for production deployments.

**Why now**: Epic 10 (Architecture Maintainability & Performance Hardening) in Release E targets this exact problem. The existing implementation works for small scopes but becomes pathological at scale.

## What Changes

1. **Replace O(N²) pairwise comparison with ANN top-k candidate generation**: Use LanceDB's vector index to retrieve top-k most similar candidates per memory, reducing comparison complexity from O(N²) to O(N × k) where k is configurable (default: 50).

2. **Add chunked processing with yield points**: Process consolidation in batches (e.g., 100 memories per batch) with explicit yield points to prevent event loop starvation. Use `setImmediate` or chunked async iteration pattern.

3. **Introduce progressive consolidation progress reporting**: Emit structured logs at each chunk boundary to enable observability and cancellation detection.

4. **Configurable candidate limit**: Add `dedup.candidateLimit` config (default: 50, max: 200) to tune precision/recall trade-off. Higher values = more thorough but slower; lower values = faster but may miss some duplicates.

**Non-breaking**: All existing tool interfaces (`memory_consolidate`, `memory_consolidate_all`) remain unchanged. Internal implementation only.

## Capabilities

### New Capabilities

- `consolidation-ann-chunking`: Scalable duplicate consolidation using ANN-based candidate retrieval and chunked processing to prevent event loop blocking.

### Modified Capabilities

- `memory-consolidation`: Requirements change from O(N²) to O(N×k) complexity with explicit yield points. Query semantics unchanged; performance characteristics improved.

## Impact

### Code Changes

| File | Change |
|------|--------|
| `src/store.ts` | Refactor `consolidateDuplicates()` to use ANN top-k + chunked iteration |
| `src/config.ts` | Add `dedup.candidateLimit` config resolution |
| `src/types.ts` | Add `DedupConfig.candidateLimit` type |
| `src/index.ts` | Add structured logging for consolidation progress |

### API Changes

- **No public API changes**: `memory_consolidate` and `memory_consolidate_all` tool signatures unchanged
- **No schema changes**: Memory record schema unchanged

### Dependencies

- **No new dependencies**: Uses existing LanceDB vector index (`search()` with `vectorWeight=1, bm25Weight=0`)
- **Config additions**: `LANCEDB_OPENCODE_PRO_DEDUP_CANDIDATE_LIMIT` environment variable

### Performance Impact

| Scope Size | Before (O(N²)) | After (O(N×k), k=50) | Improvement |
|------------|----------------|----------------------|-------------|
| 100 | ~10K comparisons | ~5K comparisons | 50% |
| 1,000 | ~500K comparisons | ~50K comparisons | 90% |
| 3,000 | ~4.5M comparisons | ~150K comparisons | 97% |

### Runtime Surface

| Aspect | Value |
|--------|-------|
| Surface Type | Plugin internal (not user-facing tool) |
| Entrypoint | `src/index.ts` → `session.compacted` hook → `store.consolidateDuplicates()` |
| Trigger | Automatic (session end) or manual (`memory_consolidate` tool) |
| Observability | Structured logs at chunk boundaries |

### Changelog Wording Class

`internal-only` — This is a performance-hardening change with no user-facing capability changes. Changelog should explicitly state it's an internal optimization for large-scope consolidation.