## Context

The `consolidateDuplicates()` method in `src/store.ts` (lines 371-445) performs O(N²) pairwise comparisons across all memories in a scope. This causes event loop blocking when scope sizes grow large (e.g., 3000 entries → 4.5M comparisons). The plugin runs in a single-threaded Node.js process where long-running CPU-bound operations starve the event loop, making the plugin unresponsive.

**Current Implementation Pattern**:
```typescript
// O(N²) double loop
for (let i = 0; i < rowsWithNorms.length; i += 1) {
  for (let j = i + 1; j < rowsWithNorms.length; j += 1) {
    const sim = storeFastCosine(a.row.vector, b.row.vector, a.norm, b.norm);
    if (sim >= threshold) { /* merge logic */ }
  }
}
```

**Existing Infrastructure**:
- LanceDB vector index already supports ANN queries via `table.search()`
- `ScopeCache` provides pre-computed norms and IDF
- `store.search()` already implements `vectorWeight=1, bm25Weight=0` for vector-only search
- `session.compacted` hook is fire-and-forget, allowing async processing

**Constraint**: Must remain a fire-and-forget operation. No synchronous blocking in the main event loop.

---

## Goals / Non-Goals

**Goals:**
- Reduce consolidation complexity from O(N²) to O(N×k) where k is configurable
- Add chunked processing with explicit yield points to prevent event loop starvation
- Preserve merge semantics (newer wins, older soft-deleted with `mergedInto` reference)
- Maintain backwards compatibility with all existing tool interfaces
- Enable observability via structured logging at chunk boundaries

**Non-Goals:**
- Real-time consolidation on every capture (still background/batch)
- Cross-scope consolidation (remains scope-internal)
- LLM-based semantic judgement (still cosine threshold)
- Perfect deduplication (ANN may miss some edge cases vs. exhaustive comparison)
- GPU acceleration (out of scope)

---

## Decisions

### Decision Table

| Decision | Choice | Why | Trade-off |
|----------|--------|-----|-----------|
| Runtime surface | internal-api | Consolidation is triggered by `session.compacted` hook or `memory_consolidate` tool; both call internal `consolidateDuplicates()` | Not user-facing; no tool API changes |
| Entrypoint | `src/store.ts` → `consolidateDuplicates(scope, threshold)` | Preserves existing API; all callers unchanged | Single refactoring point |
| Algorithm | ANN top-k + exact verification | LanceDB's vector index provides O(log N) candidate retrieval vs O(N²) brute-force; top-k candidates then verified with exact cosine | May miss some duplicates beyond top-k; configurable via `candidateLimit` |
| Chunking | Batch-driven with `setImmediate` yield | Process `BATCH_SIZE` memories, then yield to event loop via `setImmediate` before next batch | Adds async complexity but prevents blocking |
| Data model | No changes | `MemoryRecord` schema remains unchanged; consolidate semantics unchanged | Zero migration |
| Failure handling | Graceful degradation | On vector index error, fall back to O(N²) for small scopes (N < 500); for larger scopes, log warning and continue | Safety net; small scopes still get thorough dedup |
| Observability | Structured logs at chunk boundaries | Log `{ chunkIndex, processedCount, mergedCount, scope, timestamp }` at INFO level | Enables progress monitoring without new metrics infrastructure |
| Config | `dedup.candidateLimit` (default: 50, max: 200) | Higher = more thorough, slower; lower = faster, may miss duplicates | Tunable by operators |

---

### Decision 1: ANN-based candidate retrieval

**Choice**: Use LanceDB's vector index to retrieve top-k most similar candidates per memory, then verify with exact cosine.

**Algorithm**:
```
for each memory m in scope:
  candidates = vectorSearch(m.vector, limit=k, scope=scope)
  for each candidate c in candidates:
    exactSim = fastCosine(m.vector, c.vector, m.norm, c.norm)
    if exactSim >= threshold:
      apply merge logic (newer wins)
```

**Rationale**: LanceDB's vector index uses IVF-PQ or HNSW for ANN queries. Top-k retrieval is O(log N) for IVF-based indices. Exact verification ensures we don't merge based on approximate similarity alone.

**Trade-off**: ANN may not return all same-cluster neighbors. Top-k with k=50 covers 95%+ of true duplicates in practice (based on Mem0 benchmarks). Operators can increase `candidateLimit` for thoroughness.

---

### Decision 2: Chunked processing with yield points

**Choice**: Process memories in batches of `BATCH_SIZE=100`, yielding to the event loop via `setImmediate` between batches.

**Algorithm**:
```typescript
const BATCH_SIZE = 100;
const CHUNK_DELAY_MS = 0; // setImmediate = yield now

for (let offset = 0; offset < memories.length; offset += BATCH_SIZE) {
  const batch = memories.slice(offset, offset + BATCH_SIZE);
  // Process batch...
  await new Promise(resolve => setImmediate(resolve));
  // Yield point - allows pending I/O to process
}
```

**Rationale**: `setImmediate` schedules the next batch on the next event loop iteration, allowing pending I/O (tool calls, timers) to be processed. This prevents the plugin from becoming unresponsive during consolidation.

**Trade-off**: Adds latency to consolidation ( CHUNK_COUNT × 0ms overhead ), but this is acceptable for a background operation. Total wall-clock time increases marginally; event loop blocking decreases dramatically.

---

### Decision 3: Fallback for small scopes

**Choice**: For scopes with fewer than `FALLBACK_THRESHOLD=500` memories, fall back to O(N²) if vector index fails.

**Rationale**: Small scopes don't suffer significant blocking. Falling back ensures thoroughness for small scopes while protecting large scopes.

**Trade-off**: Code complexity for fallback path. Acceptable given the safety net it provides.

---

## Risks / Trade-offs

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| ANN misses duplicates beyond top-k | Medium | Low | Configurable `candidateLimit`; operators can increase for thoroughness |
| Chunked processing adds memory fragmentation | Low | Low | Batches are small (100); memory reused across batches |
| Vector index cold start | Low | Low | ScopeCache already warms index on first search; consolidation runs after session ends |
| Concurrent consolidation calls | Very Low | Low | Tool idempotency check in `src/index.ts` prevents duplicate runs |
| Index corruption | Very Low | Medium | Fallback to O(N²) for small scopes; graceful degradation logging |

---

## Migration Plan

1. **No deployment action required**: This is an internal optimization.
2. **Config rollout**: `dedup.candidateLimit` defaults to 50; operators can set env var if needed.
3. **Logging standard**: Structured logs follow existing `console.log` pattern with JSON fields.
4. **Rollback**: Reverts to O(N²) if `candidateLimit` is set to a very high value (>10000) — effectively exhaustive search.

---

## Open Questions

1. ~~Should streaming progress be exposed via a new tool?~~ → **DEFERRED** — Structured logs sufficient for v1. Progress tool can be added in BL-045 if operators request it.

2. ~~Should `candidateLimit` be auto-tuned based on scope size?~~ → **NO** — Keep simple. Let operators tune manually. Auto-tuning adds complexity without clear value.

3. ~~Should consolidation be cancellable mid-run?~~ → **DEFERRED** — Requires state tracking and cancellation token infrastructure. Out of scope for BL-044.

---

## Operability

### Trigger Path

1. **Automatic**: `session.compacted` event → `flushAutoCapture()` completes → `consolidateDuplicates(scope, dedup.consolidateThreshold)` (fire-and-forget)
2. **Manual**: User calls `memory_consolidate(scope, confirm=true)` → `consolidateDuplicates(scope, dedup.consolidateThreshold)` (awaited)

### Expected Visible Output

| Channel | Output |
|---------|--------|
| Tool response | `{ mergedPairs: N, updatedRecords: M, skippedRecords: K, scope: "..." }` (unchanged) |
| Logs | INFO: `{"msg":"consolidate:chunk","scope":"project:abc","chunk":1,"total":30,"merged":2,"candidates":50}` |
| Metrics | (Future) `consolidation.duration_ms`, `consolidation.chunks_processed` |

### Misconfiguration Behavior

| Scenario | Behavior |
|----------|----------|
| `candidateLimit > 200` | Clamped to 200 with warning log; prevents runaway memory usage |
| `candidateLimit < 10` | Clamped to 10 with warning log; ensures minimum coverage |
| Vector index unavailable | Falls back to O(N²) for scopes < 500; logs warning |
| Scope empty | Returns `{ mergedPairs: 0, updatedRecords: 0, skippedRecords: 0 }` immediately |

### Error Handling

| Error | Response |
|-------|----------|
| LanceDB query error | Log error, fall back to O(N²) for small scopes, or return zeros for large scopes |
| Memory write conflict | Skip conflicting memory (optimistic lock), log warning, continue |
| Timeout (if streaming added later) | Cancel gracefully, log partial results |

---

## Verification Matrix

| Requirement | Unit | Integration | E2E | Required to release |
|-------------|------|-------------|-----|---------------------|
| R1: ANN candidate retrieval | ✅ | ✅ | n/a | yes |
| R2: Chunked processing with yield | ✅ | ✅ | n/a | yes |
| R3: Progress logging | ✅ | n/a | n/a | yes |
| R4: Config resolution | ✅ | n/a | n/a | yes |
| R5: Fallback for small scopes | ✅ | ✅ | n/a | yes |
| R6: O(N×k) complexity at scale | ✅ (bench) | ✅ (bench) | n/a | yes |
| R7: Backward compatibility | n/a | ✅ | ✅ | yes |
| R8: No event loop blocking | n/a | ✅ (bench) | n/a | yes |