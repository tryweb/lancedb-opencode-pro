# Long-Term Memory System Validation Checklist
## LanceDB OpenCode Memory Provider

**Status**: v0.1.0 (Early Stage)  
**Last Updated**: March 2026  
**Audience**: Dev team prioritizing testability & practical usefulness

---

## PHASE 0: FOUNDATION TESTS (MUST PASS FIRST)

### 0.1 Schema Integrity & Compatibility
- [ ] **Vector Dimension Consistency**
  - Test: Reject records with mismatched `vectorDim` vs. embedding model output
  - Measurement: Count incompatible vectors via `countIncompatibleVectors()`
  - Acceptance: 0 incompatible vectors in active scopes
  - Reference: `store.ts:134-137` (dimension guard)

- [ ] **Schema Version Tracking**
  - Test: Verify `schemaVersion` field persists across all records
  - Measurement: Query all records, check version consistency
  - Acceptance: All records have matching `schemaVersion` for their scope
  - Why: Prevents unsafe vector mixing when embedding model changes

- [ ] **Embedding Model Metadata**
  - Test: Store & retrieve `embeddingModel` field with each record
  - Measurement: Verify model name matches config on retrieval
  - Acceptance: 100% of records have correct model metadata
  - Why: Guards against using vectors from different embedding models

### 0.2 Data Persistence & Recovery
- [ ] **Write-Read Cycle**
  - Test: Insert record → read back → verify all fields match
  - Measurement: 100 records across 3 scopes
  - Acceptance: 100% match rate
  - Reference: `store.ts:69-72` (put), `store.ts:119-122` (list)

- [ ] **Scope Isolation**
  - Test: Write to `project:repo-a`, verify not visible in `project:repo-b`
  - Measurement: Cross-scope query attempts
  - Acceptance: 0 cross-scope leaks
  - Reference: `scope.ts` (scope resolution)

- [ ] **Timestamp Ordering**
  - Test: Insert 10 records with known timestamps, list by scope
  - Measurement: Verify descending timestamp order
  - Acceptance: 100% correct ordering
  - Reference: `store.ts:121` (sort by timestamp)

---

## PHASE 1: RETRIEVAL QUALITY (CORRECTNESS)

### 1.1 Vector Search Accuracy
- [ ] **Recall@K Metric** (Robustness-δ@K from Microsoft Research)
  - Test: Create 100 synthetic queries with known ground truth
  - Measurement: Calculate Recall@5, Recall@10, Recall@20
  - Acceptance Criteria:
    - Recall@10 ≥ 0.85 (85% of expected results retrieved)
    - Robustness-0.5@10 ≥ 0.90 (90% of queries achieve ≥50% recall)
  - Why: Average recall hides tail performance; robustness catches hard queries
  - Reference: Wang et al. (2025) "Towards Robustness" - arxiv.org/html/2507.00379v1

- [ ] **Cosine Similarity Correctness**
  - Test: Compare computed similarity vs. manual calculation
  - Measurement: 50 vector pairs, verify ±0.001 precision
  - Acceptance: 100% match within tolerance
  - Reference: `utils.ts` (cosineSimilarity function)

- [ ] **BM25 Lexical Scoring**
  - Test: Query "Nginx 502" should rank "Nginx 502 proxy_buffer_size" higher than "502 error"
  - Measurement: Rank position of exact-match vs. partial-match
  - Acceptance: Exact match in top 3 results
  - Reference: `store.ts:93` (bm25LikeScore)

### 1.2 Hybrid Retrieval Balance
- [ ] **Vector vs. BM25 Weight Tuning**
  - Test: Same query with vectorWeight=[0.5, 0.7, 0.9], bm25Weight inverse
  - Measurement: Top-5 result overlap, relevance ranking
  - Acceptance: 
    - vectorWeight=0.7 produces balanced results (semantic + keyword)
    - No single weight dominates unexpectedly
  - Why: Hybrid search requires empirical tuning; default 0.7/0.3 may not suit all domains

- [ ] **Min Score Threshold Effectiveness**
  - Test: Query with minScore=[0.05, 0.2, 0.5]
  - Measurement: Result count, quality of lowest-ranked result
  - Acceptance:
    - minScore=0.2 filters noise without losing relevant results
    - Result count decreases monotonically with minScore

### 1.3 Semantic Relevance (Domain-Specific)
- [ ] **Category-Based Filtering**
  - Test: Store records with categories [preference, fact, decision, entity, other]
  - Measurement: Query "Nginx config" → verify decision/fact records rank higher than preferences
  - Acceptance: Relevant categories in top 3 results
  - Why: Categories should influence ranking for domain-specific memory

- [ ] **Importance Weighting**
  - Test: Same text with importance=[0.1, 0.5, 0.9]
  - Measurement: Rank position of high-importance vs. low-importance
  - Acceptance: High-importance records appear in top 5 more frequently
  - Note: Current implementation doesn't use importance in scoring; consider adding

---

## PHASE 2: SCOPE ISOLATION & MULTI-TENANCY

### 2.1 Scope Resolution
- [ ] **Project Scope Extraction**
  - Test: sessionID="sess-proj-a-001" → extract scope="project:proj-a"
  - Measurement: 20 sessions across 3 projects
  - Acceptance: 100% correct scope extraction
  - Reference: `scope.ts` (scope resolution logic)

- [ ] **Global Scope Inclusion**
  - Test: With `includeGlobalScope=true`, query should search both project + global
  - Measurement: Record in global scope retrieved when querying project scope
  - Acceptance: Global records appear in results when enabled
  - Reference: `config.ts` (includeGlobalScope flag)

- [ ] **Scope Boundary Enforcement**
  - Test: Delete record in project:repo-a, verify not deleted in project:repo-b
  - Measurement: Count records before/after delete in each scope
  - Acceptance: Only target scope affected
  - Reference: `store.ts:104-110` (deleteById with scope check)

### 2.2 Multi-Session Consistency
- [ ] **Concurrent Writes**
  - Test: 5 parallel sessions writing to same project scope
  - Measurement: Final record count, no duplicates
  - Acceptance: All records persisted, no data loss
  - Note: LanceDB handles this; verify no race conditions in wrapper

- [ ] **Session Isolation**
  - Test: Session A writes "secret-config", Session B cannot retrieve it
  - Measurement: Cross-session search attempts
  - Acceptance: 0 cross-session leaks

---

## PHASE 3: REGRESSION TESTS (PREVENT REGRESSIONS)

### 3.1 Auto-Capture Correctness
- [ ] **Text Extraction from Assistant Responses**
  - Test: Complete hook with known response text
  - Measurement: Verify captured text matches response
  - Acceptance: 100% match
  - Reference: `extract.ts` (capture logic)

- [ ] **Minimum Length Enforcement**
  - Test: Response with 20 chars (below minCaptureChars=30)
  - Measurement: Should not be captured
  - Acceptance: Record count unchanged
  - Reference: `config.ts` (minCaptureChars)

- [ ] **Category Assignment**
  - Test: Response "We decided to use Postgres" → should assign category="decision"
  - Measurement: Verify category in stored record
  - Acceptance: Correct category assigned
  - Reference: `extract.ts` (category detection)

### 3.2 Tool Safety & Confirmation
- [ ] **Delete Confirmation Required**
  - Test: `memory_delete` with confirm=false → should reject
  - Measurement: Record still exists after rejection
  - Acceptance: Record count unchanged
  - Reference: `e2e-opencode-memory.mjs:125-126`

- [ ] **Clear Confirmation Required**
  - Test: `memory_clear` with confirm=false → should reject
  - Measurement: Scope still has records after rejection
  - Acceptance: Record count unchanged
  - Reference: `e2e-opencode-memory.mjs:131-132`

### 3.3 Index Health Monitoring
- [ ] **Vector Index Status**
  - Test: Call `memory_stats` → check indexState.vector
  - Measurement: Boolean flag
  - Acceptance: true after successful init
  - Reference: `store.ts:139-145` (getIndexHealth)

- [ ] **FTS Index Status**
  - Test: Call `memory_stats` → check indexState.fts
  - Measurement: Boolean flag + error message if failed
  - Acceptance: true if BM25 available, false with error message if not
  - Why: FTS is optional; graceful degradation needed

### 3.4 Scope Pruning
- [ ] **Max Entries Enforcement**
  - Test: Set maxEntriesPerScope=50, insert 100 records
  - Measurement: Final record count in scope
  - Acceptance: ≤50 records (oldest pruned)
  - Reference: `store.ts:124-132` (pruneScope)

- [ ] **Pruning Preserves Recent Records**
  - Test: Insert 100 records with timestamps, prune to 50
  - Measurement: Verify oldest 50 are deleted
  - Acceptance: Remaining records have highest timestamps

---

## PHASE 4: PERFORMANCE & SCALABILITY

### 4.1 Latency Benchmarks
- [ ] **Search Latency (p50, p99)**
  - Test: 1000 searches on 10K records
  - Measurement: p50 latency, p99 latency
  - Acceptance:
    - p50 < 100ms (hybrid search)
    - p99 < 500ms
  - Why: Dev tool must be responsive; tail latency matters for UX

- [ ] **Insert Latency**
  - Test: 100 sequential inserts
  - Measurement: Average time per insert
  - Acceptance: < 50ms per record

- [ ] **Scope Listing Latency**
  - Test: List 1000 records from scope
  - Measurement: Time to retrieve + sort
  - Acceptance: < 200ms

### 4.2 Memory Usage
- [ ] **Vector Storage Efficiency**
  - Test: Store 10K records with 384-dim vectors
  - Measurement: Disk usage
  - Acceptance: < 50MB (reasonable for dev tool)
  - Note: LanceDB handles compression; verify no memory leaks

- [ ] **Index Overhead**
  - Test: Compare disk usage with/without vector index
  - Measurement: Overhead percentage
  - Acceptance: < 20% overhead

### 4.3 Scalability Limits
- [ ] **Max Records Per Scope**
  - Test: Insert 100K records into single scope
  - Measurement: Search latency degradation
  - Acceptance: p50 latency < 500ms (acceptable degradation)
  - Note: Pruning should prevent this in practice

- [ ] **Max Scopes**
  - Test: Create 1000 project scopes
  - Measurement: Scope resolution time
  - Acceptance: < 10ms per scope lookup

---

## PHASE 5: EMBEDDING PROVIDER INTEGRATION

### 5.1 Ollama Integration
- [ ] **Connection Resilience**
  - Test: Ollama unavailable → embedding should fail gracefully
  - Measurement: Error message clarity
  - Acceptance: Clear error, no silent failures
  - Reference: `embedder.ts` (Ollama client)

- [ ] **Model Availability Check**
  - Test: Request embedding with unavailable model
  - Measurement: Error handling
  - Acceptance: Fail fast with clear message

- [ ] **Embedding Consistency**
  - Test: Same text → same embedding vector (deterministic)
  - Measurement: 10 identical queries
  - Acceptance: 100% identical vectors

- [ ] **Timeout Handling**
  - Test: Slow embedding response (>5s)
  - Measurement: Timeout behavior
  - Acceptance: Timeout after `timeoutMs` config, no hang

### 5.2 Embedding Dimension Validation
- [ ] **Dimension Mismatch Detection**
  - Test: Change embedding model (384-dim → 768-dim)
  - Measurement: System should reject old vectors
  - Acceptance: Clear error, no silent mixing
  - Reference: `store.ts:134-137` (countIncompatibleVectors)

---

## PHASE 6: EDGE CASES & ERROR HANDLING

### 6.1 Malformed Input
- [ ] **Empty Query String**
  - Test: `memory_search` with query=""
  - Measurement: Behavior (should return nothing or all)
  - Acceptance: Defined behavior, no crash

- [ ] **Null/Undefined Vectors**
  - Test: Insert record with vector=null
  - Measurement: Error handling
  - Acceptance: Validation error, not silent failure

- [ ] **Invalid Scope Format**
  - Test: Scope with special chars: "project:repo@#$"
  - Measurement: Sanitization
  - Acceptance: Either sanitized or rejected with error

### 6.2 Boundary Conditions
- [ ] **Zero Records in Scope**
  - Test: Search empty scope
  - Measurement: Result count
  - Acceptance: Empty array, no error

- [ ] **Single Record in Scope**
  - Test: Search with 1 record
  - Measurement: Recall calculation
  - Acceptance: Recall@1 = 1.0 if match

- [ ] **Very Long Text**
  - Test: Insert record with 100KB text
  - Measurement: Storage, retrieval time
  - Acceptance: Handled gracefully (truncate or store as-is)

### 6.3 Concurrent Operations
- [ ] **Delete During Search**
  - Test: Search while another session deletes records
  - Measurement: Search result consistency
  - Acceptance: No crashes, results reflect state at query time

- [ ] **Prune During Insert**
  - Test: Insert while pruning runs
  - Measurement: Final record count
  - Acceptance: Consistent state

---

## PHASE 7: DOCUMENTATION & OBSERVABILITY

### 7.1 Memory Stats Completeness
- [ ] **Stats Output Format**
  - Test: Call `memory_stats`
  - Measurement: JSON structure
  - Acceptance: Contains: recentCount, scope, indexHealth
  - Reference: `e2e-opencode-memory.mjs:113-116`

- [ ] **Stats Accuracy**
  - Test: Insert 10 records, call stats
  - Measurement: recentCount value
  - Acceptance: Matches actual record count

### 7.2 Error Messages
- [ ] **Clarity & Actionability**
  - Test: Trigger each error path
  - Measurement: Error message quality
  - Acceptance: Message explains problem + suggests fix
  - Example: "Vector dimension mismatch: expected 384, got 768. Run memory_clear to reset."

### 7.3 Runtime Effectiveness Summary
- [ ] **System-Health Metrics Are Reported**
  - Test: Run `memory_effectiveness` after a realistic write/recall workflow
  - Measurement: Verify capture success, skip reasons, recall hit rate, and recall injection rate are present
  - Acceptance: Summary includes all runtime fields needed to judge operational health

- [ ] **Zero Feedback Is Treated As Unknown Quality**
  - Test: Review a summary with sparse or zero `feedback.*` counts
  - Measurement: Confirm release guidance does not treat zero counts as success
  - Acceptance: Review docs require proxy metrics or sample audits before claiming usefulness

### 7.4 Low-Feedback Proxy Metrics
- [ ] **Repeated-Context Reduction Review**
  - Test: Compare follow-up sessions before/after memory use
  - Measurement: Whether users repeat less project context manually
  - Acceptance: Review process documents whether context repetition decreases, stays flat, or worsens

- [ ] **Clarification Burden Review**
  - Test: Inspect conversations after recall injection
  - Measurement: Count reminder or context-recovery questions that should have been avoided
  - Acceptance: Review process can identify whether memory reduced clarification turns

- [ ] **Manual Memory Rescue Review**
  - Test: Inspect whether operators still need `memory_search` after automatic recall
  - Measurement: Manual search frequency relative to recall-heavy workflows
  - Acceptance: Review process can describe whether automatic recall still required manual rescue

- [ ] **Correction-Signal Review**
  - Test: Inspect `memory_feedback_wrong`, `memory_feedback_missing`, and correction-like conversation turns
  - Measurement: Frequency of stale, wrong, or irrelevant recall corrections
  - Acceptance: Review process can identify whether memory introduced prompt contamination or stale context

### 7.5 Sample Audit Workflow
- [ ] **Sampled Recall Audit**
  - Test: Review 10-20 recent recall injections from one active project scope
  - Measurement: Classify each as relevant, neutral noise, or misleading
  - Acceptance: Audit result is documented before release claims are made in sparse-feedback environments

- [ ] **Sampled Skipped-Capture Audit**
  - Test: Review 10-20 skipped captures, especially `no-positive-signal`
  - Measurement: Determine whether durable decisions, facts, or preferences were missed
  - Acceptance: Audit result identifies whether capture heuristics are too strict for real usage

---

## IMPLEMENTATION ROADMAP

### Sprint 1: Foundation (Weeks 1-2)
- [ ] Implement Phase 0 tests (schema, persistence)
- [ ] Implement Phase 1.1 tests (vector accuracy)
- [ ] Create test harness with synthetic data

### Sprint 2: Retrieval Quality (Weeks 3-4)
- [ ] Implement Phase 1.2-1.3 tests (hybrid search, categories)
- [ ] Implement Phase 3 regression tests
- [ ] Add Robustness-δ@K metric calculation

### Sprint 3: Scope & Safety (Weeks 5-6)
- [ ] Implement Phase 2 tests (scope isolation)
- [ ] Implement Phase 6 edge case tests
- [ ] Add comprehensive error handling

### Sprint 4: Performance & Polish (Weeks 7-8)
- [ ] Implement Phase 4 benchmarks
- [ ] Implement Phase 5 embedding tests
- [ ] Implement Phase 7 observability

---

## MEASUREMENT TOOLS & SCRIPTS

### Test Data Generation
```typescript
// Generate synthetic memory records with known ground truth
function generateTestDataset(size: number, vectorDim: number) {
  const records = [];
  for (let i = 0; i < size; i++) {
    records.push({
      id: `test-${i}`,
      text: `Test record ${i} with unique content`,
      vector: randomVector(vectorDim),
      category: randomCategory(),
      scope: `project:test`,
      importance: Math.random(),
      timestamp: Date.now() - Math.random() * 86400000,
    });
  }
  return records;
}
```

### Recall@K Calculator
```typescript
function calculateRecall(retrieved: string[], groundTruth: string[], k: number) {
  const topK = retrieved.slice(0, k);
  const matches = topK.filter(id => groundTruth.includes(id)).length;
  return matches / k;
}

function calculateRobustness(recalls: number[], delta: number) {
  const passing = recalls.filter(r => r >= delta).length;
  return passing / recalls.length;
}
```

### Latency Profiler
```typescript
async function profileLatency(fn: () => Promise<any>, iterations: number) {
  const times = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  return {
    p50: times[Math.floor(times.length * 0.5)],
    p99: times[Math.floor(times.length * 0.99)],
    avg: times.reduce((a, b) => a + b) / times.length,
  };
}
```

---

## SUCCESS CRITERIA FOR v0.1.0

✅ **MUST HAVE** (Blocking Release)
- [ ] Phase 0: All schema & persistence tests pass
- [ ] Phase 1.1: Recall@10 ≥ 0.85, Robustness-0.5@10 ≥ 0.90
- [ ] Phase 2.1: Scope isolation 100% correct
- [ ] Phase 3: All regression tests pass
- [ ] Phase 6.1: No crashes on malformed input

✅ **SHOULD HAVE** (High Priority)
- [ ] Phase 1.2: Hybrid search tuning validated
- [ ] Phase 4.1: p50 latency < 100ms on 10K records
- [ ] Phase 5.1: Ollama integration tested
- [ ] Phase 7: Stats & error messages complete

⚠️ **NICE TO HAVE** (Future)
- [ ] Phase 4.3: Scalability to 100K records
- [ ] Phase 5.2: Multiple embedding provider support
- [ ] Advanced observability (query tracing, performance dashboards)

---

## REFERENCES

1. **Robustness-δ@K Metric**: Wang et al. (2025) "Towards Robustness: A Critique of Current Vector Database Assessments"
   - https://arxiv.org/html/2507.00379v1
   - Key insight: Average recall hides tail performance; use Robustness-δ@K to measure consistency

2. **Vector Database Benchmarking**: VIBE Project (2025)
   - https://arxiv.org/pdf/2505.17810
   - Methodology for realistic embedding benchmarks

3. **Production Vector Search**: Kawaldeep Singh (2026) "Vector Databases in 2026"
   - https://kawaldeepsingh.medium.com/...
   - Practical guidance on production deployment

4. **Existing E2E Test**: `scripts/e2e-opencode-memory.mjs`
   - Reference implementation for test structure

---

## NOTES FOR TEAM

- **Prioritize Robustness-δ@K**: This metric is more actionable than average recall for dev tools
- **Test with Real Queries**: Use actual OpenCode session data (anonymized) for ground truth
- **Monitor Tail Performance**: p99 latency matters more than average for interactive tools
- **Scope Isolation is Critical**: Multi-project support depends on bulletproof scope enforcement
- **Embedding Provider Abstraction**: Design tests to support future providers (OpenAI, local models, etc.)
