# Memory System Validation Framework
## Complete Guide for LanceDB OpenCode Memory Provider

**Status**: v0.1.0 Ready for Testing  
**Last Updated**: March 2026  
**Audience**: Development team

---

## 📚 Documentation Structure

This validation framework consists of 4 documents:

### 1. **validation-priority-summary.md** ⭐ START HERE
- **Purpose**: Quick reference for what to test first
- **Content**: Top 5 priorities, effort/impact matrix, week 1 plan
- **Time to Read**: 10 minutes
- **Best For**: Getting started quickly, understanding priorities

### 2. **memory-validation-checklist.md** 📋 COMPREHENSIVE
- **Purpose**: Complete validation specification
- **Content**: 7 phases with 50+ test cases, acceptance criteria, references
- **Time to Read**: 30 minutes (skim) / 2 hours (detailed)
- **Best For**: Planning implementation, understanding all requirements

### 3. **test-implementation-guide.md** 💻 CODE EXAMPLES
- **Purpose**: Practical TypeScript code for each test
- **Content**: Ready-to-use test implementations, helpers, setup
- **Time to Read**: 20 minutes (skim) / 1 hour (implement)
- **Best For**: Writing actual tests, copy-paste starting points

### 4. **VALIDATION_README.md** (this file) 🗺️ NAVIGATION
- **Purpose**: Overview and navigation guide
- **Content**: Document structure, quick links, execution plan

---

## 🎯 Quick Start (30 minutes)

1. **Read** `validation-priority-summary.md` (10 min)
   - Understand top 5 priorities
   - Review effort/impact matrix
   - Check week 1 plan

2. **Skim** `memory-validation-checklist.md` (10 min)
   - Focus on Phase 0, 1.1, 2.1 sections
   - Note acceptance criteria

3. **Copy** test code from `test-implementation-guide.md` (10 min)
   - Start with Phase 0 tests
   - Set up test harness

---

## 🚀 Execution Plan

### Week 1: Foundation (Critical Path)
```
Day 1-2: Phase 0 (Foundation)
  ✓ Vector dimension consistency
  ✓ Scope isolation
  ✓ Write-read cycle
  
Day 3-4: Phase 1.1 (Retrieval Quality)
  ✓ Recall@K metric
  ✓ Robustness-δ@K metric
  
Day 5: Phase 3.1 + 4.1 (Regression + Performance)
  ✓ Auto-capture correctness
  ✓ Search latency benchmarks
```

### Week 2-3: Comprehensive Coverage
```
Phase 1.2: Hybrid search tuning
Phase 2.1: Scope isolation (advanced)
Phase 3.2: Tool safety
Phase 5.1: Ollama integration
Phase 6.1: Edge cases
```

### Week 4: Polish & Documentation
```
Phase 4.2: Memory usage
Phase 7: Observability & stats
Documentation & error messages
```

---

## 📊 Key Metrics to Track

### Correctness Metrics
| Metric | Target | Phase | Reference |
|--------|--------|-------|-----------|
| Recall@10 | ≥ 0.85 | 1.1 | Wang et al. (2025) |
| Robustness-0.5@10 | ≥ 0.90 | 1.1 | Microsoft Research |
| Scope isolation | 0 leaks | 2.1 | Data privacy |
| Vector dimension match | 100% | 0.1 | Data integrity |

### Performance Metrics
| Metric | Target | Phase | Reference |
|--------|--------|-------|-----------|
| Search p50 latency | < 100ms | 4.1 | UX requirement |
| Search p99 latency | < 500ms | 4.1 | Tail performance |
| Insert latency | < 50ms | 4.1 | Throughput |
| Disk usage (10K records) | < 50MB | 4.2 | Storage efficiency |

### Effectiveness Metrics
| Metric | Target | Phase | Reference |
|--------|--------|-------|-----------|
| Capture success rate | Reported | 7 | Effectiveness summary |
| Recall hit rate | Reported | 7 | Effectiveness summary |
| Helpful recall rate | Reported | 7 | User feedback |
| False-positive / false-negative counts | Reported | 7 | User feedback |

### Low-Feedback Proxy Metrics
| Metric | Target | Phase | Reference |
|--------|--------|-------|-----------|
| Repeated-context reduction | Reviewed | 7 | Low-feedback framework |
| Clarification burden reduction | Reviewed | 7 | Low-feedback framework |
| Manual memory rescue rate | Reviewed | 7 | Low-feedback framework |
| Correction-signal rate | Reviewed | 7 | Low-feedback framework |
| Sampled recall usefulness | Reviewed | 7 | Low-feedback framework |

Interpretation rules:

- High `recall.hitRate` indicates retrieval availability, not proven usefulness.
- Zero explicit feedback counts indicate missing labels unless a proxy-metric review or sample audit says otherwise.
- Release review should pair runtime summaries with manual proxy-metric inspection whenever feedback volume is sparse.

---

## 🔍 Critical Tests (Must Pass Before Release)

### 🔴 BLOCKING TESTS
These must pass or release is blocked:

1. **Scope Isolation** (Phase 2.1)
   - Why: Data privacy/security
   - Test: 0 cross-scope leaks
   - Impact: CRITICAL

2. **Vector Dimension Mismatch** (Phase 0.1)
   - Why: Data integrity
   - Test: Reject incompatible vectors
   - Impact: CRITICAL

3. **Recall@K >= 0.85** (Phase 1.1)
   - Why: Core functionality
   - Test: 100 synthetic queries
   - Impact: CRITICAL

### 🟠 HIGH PRIORITY TESTS
These should pass before release:

4. **Robustness-δ@K >= 0.90** (Phase 1.1)
   - Why: Prevents silent failures
   - Test: Tail performance measurement
   - Impact: HIGH

5. **Search Latency p50 < 100ms** (Phase 4.1)
   - Why: User experience
   - Test: 1000 searches on 10K records
   - Impact: HIGH

---

## 📖 Research References

### 1. Robustness-δ@K Metric
**Paper**: "Towards Robustness: A Critique of Current Vector Database Assessments"  
**Authors**: Wang et al., Microsoft Research (2025)  
**URL**: https://arxiv.org/html/2507.00379v1  
**Key Insight**: Average recall hides tail performance; use Robustness-δ@K to measure consistency

**Example**:
- System A: Recall@10 = 0.9, but 5% of queries get 0 results
- System B: Recall@10 = 0.9, but only 0.5% of queries get 0 results
- Average recall is identical, but System B is much better for users

### 2. Vector Database Benchmarking
**Project**: VIBE (Vector Index Benchmark for Embeddings)  
**URL**: https://arxiv.org/pdf/2505.17810  
**Key Insight**: Benchmarks must use realistic embedding models (not image transforms)

### 3. Production Vector Search
**Article**: "Vector Databases in 2026 — How to Pick, Build, and Scale"  
**Author**: Kawaldeep Singh (2026)  
**Key Insight**: p99 latency matters more than average; tail performance kills UX

---

## 🛠️ Tools & Setup

### Prerequisites
```bash
# Node.js 18+
node --version

# Ollama running (for embeddings)
curl http://localhost:11434/api/tags

# Test database location
mkdir -p ~/.opencode/memory/lancedb
```

### Running Tests
```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run specific phase
npm test -- phase0
npm test -- phase1

# Run with coverage
npm test -- --coverage

# Run benchmarks
npm run benchmark:latency

# Run effectiveness workflow
npm run test:effectiveness

# Clean test data
rm -rf /tmp/test-memory
```

---

## 📋 Checklist for v0.1.0 Release

### Pre-Release Validation
- [ ] All Phase 0 tests pass (foundation)
- [ ] All Phase 1.1 tests pass (retrieval quality)
- [ ] All Phase 2.1 tests pass (scope isolation)
- [ ] All Phase 3 tests pass (regression)
- [ ] Effectiveness summary workflow passes and reports capture/recall/feedback metrics
- [ ] Phase 4.1 latency benchmarks pass
- [ ] Phase 6.1 edge cases handled
- [ ] Error messages are clear & actionable
- [ ] Documentation is complete

### Performance Validation
- [ ] p50 latency < 100ms (10K records)
- [ ] p99 latency < 500ms (10K records)
- [ ] Disk usage < 50MB (10K records)
- [ ] No memory leaks (24h test)

### Data Integrity Validation
- [ ] Scope isolation: 0 leaks
- [ ] Vector dimension: 100% match
- [ ] Write-read cycle: 100% match
- [ ] Timestamp ordering: 100% correct

### User Experience Validation
- [ ] Auto-capture works correctly
- [ ] Tool safety (delete/clear confirmation)
- [ ] Error messages are helpful
- [ ] Stats output is accurate

---

## 🎓 Key Learnings

### 1. Robustness Matters More Than Average
**Problem**: Average recall = 0.9 hides that 5% of queries fail  
**Solution**: Measure Robustness-δ@K (fraction of queries achieving minimum threshold)  
**Impact**: Prevents silent failures in production

### 2. Tail Performance Kills UX
**Problem**: p50 latency = 50ms looks great, but p99 = 2000ms kills UX  
**Solution**: Always measure p99, not just average  
**Impact**: Users notice the 1% of slow queries

### 3. Vector Dimension Mismatch is Silent
**Problem**: Changing embedding model silently corrupts data  
**Solution**: Store `vectorDim` + `embeddingModel` with each record  
**Impact**: Prevents data corruption when models change

### 4. Scope Isolation is Critical
**Problem**: Multi-project support broken if scopes leak  
**Solution**: Test cross-scope leaks explicitly  
**Impact**: Data privacy/security

### 5. Hybrid Search Requires Tuning
**Problem**: Default weights (0.7/0.3) may not suit all domains  
**Solution**: Test with different weight combinations  
**Impact**: Better search quality for specific use cases

---

## 📞 Support & Escalation

### When to Escalate
| Issue | Action |
|-------|--------|
| Recall@10 < 0.80 | Review embedding model + BM25 tuning |
| Robustness-0.5@10 < 0.85 | Investigate hard queries (outliers) |
| p99 latency > 1000ms | Profile search algorithm + index |
| Scope isolation failure | STOP - data privacy issue |
| Vector dimension mismatch | STOP - data integrity issue |

### Common Pitfalls
1. ❌ Testing with < 50 queries (need statistical significance)
2. ❌ Only measuring p50 latency (p99 matters more)
3. ❌ Ignoring scope isolation (test explicitly)
4. ❌ Silent vector dimension mismatches (validate always)
5. ❌ Benchmarking with cold cache (warm up first)

---

## 📚 Document Navigation

```
VALIDATION_README.md (you are here)
├── validation-priority-summary.md
│   ├── Top 5 priorities
│   ├── Effort/impact matrix
│   ├── Week 1 plan
│   └── Minimal viable test suite
├── memory-validation-checklist.md
│   ├── Phase 0: Foundation
│   ├── Phase 1: Retrieval Quality
│   ├── Phase 2: Scope Isolation
│   ├── Phase 3: Regression Tests
│   ├── Phase 4: Performance
│   ├── Phase 5: Embedding Integration
│   ├── Phase 6: Edge Cases
│   ├── Phase 7: Observability
│   └── Success Criteria
└── test-implementation-guide.md
    ├── Setup & Harness
    ├── Phase 0 Tests (code)
    ├── Phase 1 Tests (code)
    ├── Phase 2 Tests (code)
    ├── Phase 3 Tests (code)
    ├── Phase 4 Tests (code)
    └── Running Tests
```

---

## 🎯 Next Steps

1. **Today**: Read `validation-priority-summary.md` (10 min)
2. **Tomorrow**: Set up test harness from `test-implementation-guide.md` (2 hours)
3. **This Week**: Implement Phase 0 + 1.1 tests (3 days)
4. **Next Week**: Expand to Phase 2-4 tests (4 days)
5. **Week 3**: Polish, documentation, release prep (3 days)

---

## 📝 Notes

- All test code is in TypeScript (matches project)
- Tests use existing `MemoryStore` API (no changes needed)
- Synthetic data generation included in test guide
- Latency profiler provided (p50, p99, avg)
- Robustness-δ@K calculator provided (copy-paste ready)

---

**Questions?** Refer to the specific document:
- **"What should I test first?"** → `validation-priority-summary.md`
- **"What are all the requirements?"** → `memory-validation-checklist.md`
- **"How do I write the tests?"** → `test-implementation-guide.md`
- **"How do I navigate?"** → `VALIDATION_README.md` (this file)
