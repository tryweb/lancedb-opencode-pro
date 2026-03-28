## 1. Schema Extensions

- [ ] 1.1 Add CitationSource type to src/types.ts (auto-capture, explicit-remember, import, external)
- [ ] 1.2 Add CitationStatus type to src/types.ts (verified, pending, invalid, expired)
- [ ] 1.3 Add citation fields to MemoryRecord interface (citationSource, citationTimestamp, citationStatus, citationChain)

## 2. Storage Layer

- [ ] 2.1 Add citation columns to memories table schema (nullable)
- [ ] 2.2 Update ensureMemoriesTable to add citation columns if missing
- [ ] 2.3 Add getCitation / updateCitation methods to MemoryStore

## 3. Capture Integration

- [ ] 3.1 Update auto-capture to set citation source
- [ ] 3.2 Update memory_remember tool to set citation source
- [ ] 3.3 Update memory_import tool (future) to set citation source

## 4. Validation Pipeline

- [ ] 4.1 Implement validateCitation function
- [ ] 4.2 Add citation validation to retrieval pipeline
- [ ] 4.3 Add background freshness check for expired citations

## 5. Search Results

- [ ] 5.1 Include citation info in search result formatting
- [ ] 5.2 Add citation to effectiveness events

## 6. Tools

- [ ] 6.1 Add memory_citation tool for viewing/updating citations
- [ ] 6.2 Add memory_validate_citation tool for triggering validation

## 7. Testing

- [ ] 7.1 Add unit tests for citation storage and retrieval
- [ ] 7.2 Add integration tests for citation validation pipeline
- [ ] 7.3 Add regression tests for citation display in search results

## 8. Documentation

- [ ] 8.1 Update CHANGELOG.md
- [ ] 8.2 Update README with citation feature documentation
