# Consolidation ANN Chunking Spec

## R1: ANN Candidate Retrieval

The system SHALL retrieve top-k most similar memory candidates using LanceDB vector index before performing exact cosine verification.

**Runtime Surface**: internal-api
**Entrypoint**: `src/store.ts` → `consolidateDuplicates()` → `vectorSearch()`

### Scenario: ANN returns candidates above threshold

- GIVEN a scope with 100 memories
- WHEN `consolidateDuplicates()` is called with threshold 0.95
- THEN for each memory, LanceDB vector search returns up to `candidateLimit` candidates
- AND exact cosine similarity is computed for each candidate
- AND memories with similarity >= 0.95 are marked for merge

### Scenario: ANN returns no candidates

- GIVEN a scope with 100 unique memories (no similar pairs)
- WHEN `consolidateDuplicates()` is called
- THEN each memory's vector search returns candidates below threshold
- AND no merges are performed
- AND result shows `mergedPairs: 0`

### Scenario: ANN index unavailable

- GIVEN LanceDB vector index is corrupted or unavailable
- WHEN `consolidateDuplicates()` is called
- THEN fallback to O(N²) for scopes with < 500 memories
- OR return zeros with warning log for scopes >= 500

---

## R2: Chunked Processing with Yield

The system SHALL process memories in batches of BATCH_SIZE=100, yielding to event loop between batches via setImmediate.

**Runtime Surface**: internal-api
**Entrypoint**: `src/store.ts` → `consolidateDuplicates()` → chunked loop

### Scenario: Large scope processed in chunks

- GIVEN a scope with 350 memories
- WHEN `consolidateDuplicates()` is called
- THEN processing proceeds in 4 chunks (100, 100, 100, 50)
- AND setImmediate is called between each chunk
- AND pending I/O can be processed between chunks

### Scenario: Small scope processed in single batch

- GIVEN a scope with 50 memories
- WHEN `consolidateDuplicates()` is called
- THEN all 50 memories processed in single batch
- AND no yield points triggered

### Scenario: Chunk processing captures progress

- GIVEN a scope with 300 memories
- WHEN `consolidateDuplicates()` is called
- THEN after each chunk, log emitted: `{"msg":"consolidate:chunk","chunk":N,"processed":M}`

---

## R3: Progress Logging

The system SHALL emit structured logs at each chunk boundary to enable observability and progress monitoring.

**Runtime Surface**: internal-api
**Entrypoint**: `src/store.ts` → chunk boundary logging

### Scenario: Progress logged for each chunk

- GIVEN a scope with 250 memories
- WHEN `consolidateDuplicates()` is called
- THEN 3 log entries emitted (chunks 0, 1, 2)
- AND each log contains: scope, chunkIndex, processedCount, mergedCount, timestamp

### Scenario: No logs for empty scope

- GIVEN a scope with 0 memories
- WHEN `consolidateDuplicates()` is called
- THEN no progress logs emitted

---

## R4: Config Resolution

The system SHALL resolve `dedup.candidateLimit` from config with validation bounds (min: 10, max: 200).

**Runtime Surface**: internal-api
**Entrypoint**: `src/config.ts` → `resolveDedupConfig()`

### Scenario: Default candidate limit applied

- GIVEN no LANCEDB_OPENCODE_PRO_DEDUP_CANDIDATE_LIMIT env var
- WHEN config is resolved
- THEN candidateLimit defaults to 50

### Scenario: Custom candidate limit applied

- GIVEN LANCEDB_OPENCODE_PRO_DEDUP_CANDIDATE_LIMIT=100
- WHEN config is resolved
- THEN candidateLimit set to 100

### Scenario: Candidate limit clamped above max

- GIVEN LANCEDB_OPENCODE_PRO_DEDUP_CANDIDATE_LIMIT=500
- WHEN config is resolved
- THEN candidateLimit clamped to 200
- AND warning log emitted: "candidateLimit clamped from 500 to 200"

### Scenario: Candidate limit clamped below min

- GIVEN LANCEDB_OPENCODE_PRO_DEDUP_CANDIDATE_LIMIT=5
- WHEN config is resolved
- THEN candidateLimit clamped to 10
- AND warning log emitted: "candidateLimit clamped from 5 to 10"

---

## R5: Fallback for Small Scopes

The system SHALL fall back to O(N²) exhaustive comparison when vector index fails and scope has < 500 memories.

**Runtime Surface**: internal-api
**Entrypoint**: `src/store.ts` → `consolidateDuplicates()` fallback logic

### Scenario: Fallback triggered on index error for small scope

- GIVEN scope with 300 memories
- AND vector index query throws error
- WHEN `consolidateDuplicates()` is called
- THEN falls back to O(N²) pairwise comparison
- AND completes consolidation

### Scenario: No fallback for large scope

- GIVEN scope with 2000 memories
- AND vector index query throws error
- WHEN `consolidateDuplicates()` is called
- THEN returns zeros with warning log
- AND does not attempt O(N²) fallback (would block)

---

## R6: O(N×k) Complexity at Scale

The system SHALL achieve O(N×k) complexity where k = candidateLimit, enabling linear scaling vs quadratic.

**Runtime Surface**: internal-api
**Entrypoint**: `src/store.ts` → ANN-based algorithm

### Scenario: Complexity reduced at N=3000, k=50

- GIVEN scope with 3000 memories
- WHEN `consolidateDuplicates()` is called with candidateLimit=50
- THEN total comparisons ≈ 150,000 (vs 4.5M for O(N²))
- AND completion time < 5 seconds (vs 30+ seconds)

### Observability: Complexity verification

- Benchmark mode: log actual comparison count vs theoretical O(N×k)
- Verify: actualComparisons ≈ N × candidateLimit

---

## R7: Backward Compatibility

The system SHALL preserve existing tool interfaces and semantics for `memory_consolidate` and `memory_consolidate_all`.

**Runtime Surface**: plugin-tool
**Entrypoint**: `src/index.ts` → `memory_consolidate` tool handler

### Scenario: Tool response format unchanged

- GIVEN user calls `memory_consolidate(scope="project:abc", confirm=true)`
- WHEN consolidation completes
- THEN response contains: `{ mergedPairs, updatedRecords, skippedRecords, scope }`
- AND response schema matches pre-change format

### Scenario: Tool idempotency preserved

- GIVEN user calls `memory_consolidate` twice in quick succession
- WHEN second call arrives while first is running
- THEN second call returns immediately with "consolidation already in progress"
- AND no duplicate consolidation runs

---

## R8: No Event Loop Blocking

The system SHALL ensure consolidation does not block the Node.js event loop, allowing concurrent tool invocations.

**Runtime Surface**: internal-api
**Entrypoint**: `src/store.ts` → chunked processing with yield

### Scenario: Tool invocation during consolidation

- GIVEN consolidation is running on scope with 1000 memories
- WHEN user calls `memory_recall(query="...")`
- THEN recall tool responds within 100ms
- AND does not wait for consolidation to complete

### Scenario: Event loop not starved

- GIVEN consolidation processing 1000 memories
- WHEN setImmediate yields between chunks
- THEN pending timers (e.g., session heartbeat) continue to fire
- AND event loop lag < 50ms

### Observability: Event loop monitoring

- Log event loop lag at chunk boundaries
- If lag > 100ms, emit warning: "consolidation causing event loop delay"