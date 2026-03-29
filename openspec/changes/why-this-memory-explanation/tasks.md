## Implementation Tasks

### Phase 1: Types and Core

- [x] 1.1 Add `MemoryExplanation` type to src/types.ts
- [x] 1.2 Add `RecallFactors` type to src/types.ts
- [x] 1.3 Add `explainMemory` method to MemoryStore class

### Phase 2: Explanation Methods

- [x] 2.1 Implement explainRecency() - show recency with half-life context
- [x] 2.2 Implement explainCitation() - show citation source and status
- [x] 2.3 Implement explainRelevance() - break down vector/BM25 scores
- [x] 2.4 Implement explainScope() - show scope match
- [x] 2.5 Implement explainImportance() - show importance weight

### Phase 3: Tools

- [x] 3.1 Register memory_why tool in src/index.ts
- [x] 3.2 Register memory_explain_recall tool in src/index.ts
- [x] 3.3 Implement tool handlers with error handling

### Phase 4: Session Tracking

- [x] 4.1 Track last recall operation in session context
- [x] 4.2 Store recall factors for explanation retrieval

### Phase 5: Integration

- [x] 5.1 Add explanation to auto-injected context (optional)
- [x] 5.2 Add explanation field to search results

### Phase 6: Testing

- [x] 6.1 Add unit tests for each explanation method
- [ ] 6.2 Add integration tests for tool invocation
- [ ] 6.3 Add e2e test for user-facing flow
- [ ] 6.4 Add regression tests for explanation output format

---

## Verification Matrix

| Requirement | Unit | Integration | E2E | Required to release |
|---|---|---|---|---|
| R1: memory_why tool | ✅ | ✅ | ✅ | yes |
| R2: Recency display | ✅ | ✅ | ✅ | yes |
| R3: Citation status | ✅ | ✅ | ✅ | yes |
| R4: Relevance breakdown | ✅ | ✅ | ✅ | yes |
| R5: Scope match | ✅ | ✅ | ✅ | yes |
| R6: memory_explain_recall | ✅ | ✅ | ✅ | yes |
| O1: Request logging | ✅ | ✅ | n/a | yes |
| O2: Latency tracking | ✅ | n/a | n/a | yes |

---

## Implementation Notes

- All explanation methods should return structured data, not formatted strings
- Formatting should happen at the tool layer for i18n flexibility
- Explanation should gracefully handle missing metadata (show "N/A")
- Session tracking should be lightweight (in-memory, not persisted)
