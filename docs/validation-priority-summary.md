# Memory System Validation: Priority Summary
## Quick Reference for v0.1.0 Release

---

## 🎯 TOP 5 PRIORITIES (Do These First)

### 1. **Robustness-δ@K Metric** (Phase 1.1)
**Why**: Average recall hides tail performance; your dev tool will fail on hard queries
- **Test**: 100 synthetic queries with known ground truth
- **Measure**: Recall@10 ≥ 0.85 AND Robustness-0.5@10 ≥ 0.90
- **Reference**: Wang et al. (2025) Microsoft Research paper
- **Effort**: 2-3 days (implement metric + test harness)
- **Impact**: HIGH - Prevents silent failures in production

### 2. **Scope Isolation** (Phase 2.1)
**Why**: Multi-project support is broken if scopes leak
- **Test**: Write to project:repo-a, verify invisible in project:repo-b
- **Measure**: 0 cross-scope leaks across 10 test scenarios
- **Reference**: `scope.ts` + `store.ts:104-110`
- **Effort**: 1-2 days (test + verification)
- **Impact**: CRITICAL - Data privacy/security

### 3. **Vector Dimension Mismatch Detection** (Phase 0.1)
**Why**: Changing embedding models silently corrupts data
- **Test**: Insert records with 384-dim vectors, then try 768-dim
- **Measure**: System rejects incompatible vectors with clear error
- **Reference**: `store.ts:134-137` (countIncompatibleVectors)
- **Effort**: 1 day (add validation + error handling)
- **Impact**: CRITICAL - Data integrity

### 4. **Search Latency Benchmarks** (Phase 4.1)
**Why**: Dev tool must be responsive (p99 matters more than average)
- **Test**: 1000 searches on 10K records
- **Measure**: p50 < 100ms, p99 < 500ms
- **Reference**: Kawaldeep Singh (2026) - production vector search patterns
- **Effort**: 2 days (benchmark harness + profiling)
- **Impact**: HIGH - User experience

### 5. **Auto-Capture Regression Tests** (Phase 3.1)
**Why**: Core feature; must not silently fail
- **Test**: Complete hook with known response → verify captured
- **Measure**: 100% text match, correct category assignment
- **Reference**: `extract.ts` + `e2e-opencode-memory.mjs`
- **Effort**: 1 day (expand existing e2e test)
- **Impact**: HIGH - Feature correctness

---

## 📊 EFFORT vs. IMPACT MATRIX

| Phase | Test | Effort | Impact | Priority |
|-------|------|--------|--------|----------|
| 1.1 | Robustness-δ@K | 2-3d | CRITICAL | 🔴 DO FIRST |
| 2.1 | Scope Isolation | 1-2d | CRITICAL | 🔴 DO FIRST |
| 0.1 | Vector Dimension | 1d | CRITICAL | 🔴 DO FIRST |
| 4.1 | Latency Benchmarks | 2d | HIGH | 🟠 DO SECOND |
| 3.1 | Auto-Capture | 1d | HIGH | 🟠 DO SECOND |
| 1.2 | Hybrid Search Tuning | 2d | HIGH | 🟠 DO SECOND |
| 5.1 | Ollama Integration | 1-2d | MEDIUM | 🟡 DO THIRD |
| 3.2 | Tool Safety | 1d | MEDIUM | 🟡 DO THIRD |
| 6.1 | Edge Cases | 2d | MEDIUM | 🟡 DO THIRD |
| 4.2 | Memory Usage | 1d | LOW | 🟢 LATER |
| 7.1 | Stats Completeness | 1d | LOW | 🟢 LATER |

---

## 🚀 QUICK START: WEEK 1 PLAN

### Day 1-2: Foundation (Phase 0 + 2.1)
```bash
# Create test harness
npm run test:foundation

# Tests to implement:
- Vector dimension consistency
- Scope isolation (10 scenarios)
- Write-read cycle (100 records)
```

### Day 3-4: Retrieval Quality (Phase 1.1)
```bash
# Implement Robustness-δ@K metric
npm run test:retrieval

# Tests to implement:
- Recall@K calculator
- Robustness-δ@K calculator
- 100 synthetic queries with ground truth
```

### Day 5: Auto-Capture + Latency (Phase 3.1 + 4.1)
```bash
# Expand e2e test + add benchmarks
npm run test:e2e
npm run benchmark:latency

# Tests to implement:
- Auto-capture correctness
- Search latency profiler (p50, p99)
```

---

## 📋 MINIMAL VIABLE TEST SUITE

If you only have 1 week, implement these 5 tests:

```typescript
// test/core.test.ts

describe("Memory System - Core Validation", () => {
  
  // TEST 1: Scope Isolation
  it("should isolate scopes", async () => {
    await store.put({ ...record, scope: "project:a" });
    const resultsA = await store.search({ scopes: ["project:a"] });
    const resultsB = await store.search({ scopes: ["project:b"] });
    expect(resultsA.length).toBe(1);
    expect(resultsB.length).toBe(0);
  });

  // TEST 2: Vector Dimension Mismatch
  it("should reject incompatible vectors", async () => {
    const incompatible = await store.countIncompatibleVectors(
      ["project:test"], 
      768 // different from 384
    );
    expect(incompatible).toBeGreaterThan(0);
  });

  // TEST 3: Recall@K
  it("should achieve Recall@10 >= 0.85", async () => {
    const recalls = [];
    for (const query of testQueries) {
      const results = await store.search({ ...query, limit: 10 });
      const recall = results.filter(r => groundTruth.includes(r.id)).length / 10;
      recalls.push(recall);
    }
    const avgRecall = recalls.reduce((a, b) => a + b) / recalls.length;
    expect(avgRecall).toBeGreaterThanOrEqual(0.85);
  });

  // TEST 4: Robustness-δ@K
  it("should have Robustness-0.5@10 >= 0.90", async () => {
    const recalls = []; // from TEST 3
    const passing = recalls.filter(r => r >= 0.5).length;
    const robustness = passing / recalls.length;
    expect(robustness).toBeGreaterThanOrEqual(0.90);
  });

  // TEST 5: Search Latency
  it("should search in < 100ms (p50)", async () => {
    const times = [];
    for (let i = 0; i < 100; i++) {
      const start = performance.now();
      await store.search({ query: "test", limit: 10 });
      times.push(performance.now() - start);
    }
    times.sort((a, b) => a - b);
    const p50 = times[50];
    expect(p50).toBeLessThan(100);
  });
});
```

---

## 🔍 MEASUREMENT CHECKLIST

### Before Each Test Run
- [ ] Clear database: `rm -rf ~/.opencode/memory/lancedb`
- [ ] Verify Ollama running: `curl http://localhost:11434/api/tags`
- [ ] Check disk space: `df -h`
- [ ] Record baseline metrics

### After Each Test Run
- [ ] Capture metrics (latency, recall, robustness)
- [ ] Check for memory leaks: `ps aux | grep node`
- [ ] Verify no orphaned processes
- [ ] Document any failures with reproduction steps

---

## 🎓 KEY INSIGHTS FROM RESEARCH

### 1. Robustness-δ@K (Wang et al., 2025)
**Problem**: Average recall = 0.9 hides that 5% of queries get 0 results
**Solution**: Measure fraction of queries achieving minimum threshold δ
**Example**: 
- ScaNN: Robustness-0.1@10 = 0.994 (99.4% of queries get ≥10% recall)
- DiskANN: Robustness-0.1@10 = 0.951 (95.1% of queries get ≥10% recall)
- **Difference**: 4.3% of users get no results with DiskANN

### 2. Tail Performance Matters (Kawaldeep Singh, 2026)
**Problem**: p50 latency looks good, but p99 kills UX
**Solution**: Always measure p99, not just average
**Example**: 
- p50 = 50ms (looks great)
- p99 = 2000ms (user waits 2 seconds on 1% of queries)

### 3. Vector Dimension Mismatch (LanceDB Best Practices)
**Problem**: Changing embedding model silently corrupts data
**Solution**: Store `vectorDim` + `embeddingModel` with each record
**Example**:
- Old records: 384-dim (nomic-embed-text)
- New records: 768-dim (OpenAI embedding)
- Result: Cosine similarity between different dimensions = garbage

---

## 📚 REFERENCE IMPLEMENTATIONS

### Robustness-δ@K Calculator
```typescript
function calculateRobustness(recalls: number[], delta: number): number {
  const passing = recalls.filter(r => r >= delta).length;
  return passing / recalls.length;
}

// Usage:
const recalls = [0.9, 0.8, 0.1, 0.95, 0.2]; // 5 queries
const robustness = calculateRobustness(recalls, 0.5); // 0.6 (3/5 queries >= 0.5)
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

## ⚠️ COMMON PITFALLS TO AVOID

1. **Testing with too few queries** (< 50)
   - Robustness-δ@K needs statistical significance
   - Use at least 100 queries for reliable results

2. **Not testing tail performance**
   - Don't just check average recall
   - Always measure p99 latency, not p50

3. **Ignoring scope isolation**
   - Test cross-scope leaks explicitly
   - Use multiple projects in tests

4. **Silent vector dimension mismatches**
   - Always validate vectorDim before search
   - Store embedding model name with vectors

5. **Benchmarking with cold cache**
   - Warm up indexes before measuring
   - Run 10 iterations before recording times

---

## 📞 WHEN TO ESCALATE

| Issue | Action |
|-------|--------|
| Recall@10 < 0.80 | Review embedding model quality + BM25 tuning |
| Robustness-0.5@10 < 0.85 | Investigate hard queries (outliers in vector space) |
| p99 latency > 1000ms | Profile search algorithm + index structure |
| Scope isolation failure | STOP - data privacy issue, fix before release |
| Vector dimension mismatch | STOP - data integrity issue, fix before release |
| Recall hit rate is high but feedback is near zero | Treat as insufficient evidence; review proxy metrics or run a sample audit |
| Users still repeat background context after recall | Investigate product-value gap even if system-health metrics look good |

---

## 📖 FULL DOCUMENTATION

See `memory-validation-checklist.md` for:
- All 7 phases with detailed test specifications
- Complete measurement methodology
- Implementation roadmap (4 sprints)
- Success criteria for v0.1.0
