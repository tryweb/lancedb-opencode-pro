## 1. Schema Extensions

- [x] 1.1 Add CitationSource type to src/types.ts (auto-capture, explicit-remember, import, external)
- [x] 1.2 Add CitationStatus type to src/types.ts (verified, pending, invalid, expired)
- [x] 1.3 Add citation fields to MemoryRecord interface (citationSource, citationTimestamp, citationStatus, citationChain)

## 2. Storage Layer

- [x] 2.1 Add citation columns to memories table schema (nullable)
- [x] 2.2 Update ensureMemoriesTable to add citation columns if missing
- [x] 2.3 Add getCitation / updateCitation methods to MemoryStore

## 3. Capture Integration

- [x] 3.1 Update auto-capture to set citation source
- [x] 3.2 Update memory_remember tool to set citation source
- [x] 3.3 Update memory_import tool (future) to set citation source

## 4. Validation Pipeline

- [x] 4.1 Implement validateCitation function
- [x] 4.2 Add citation validation to retrieval pipeline
- [x] 4.3 Add background freshness check for expired citations

## 5. Search Results

- [x] 5.1 Include citation info in search result formatting
- [x] 5.2 Add citation to effectiveness events

## 6. Tools

- [x] 6.1 Add memory_citation tool for viewing/updating citations
- [x] 6.2 Add memory_validate_citation tool for triggering validation

## 7. Testing

- [x] 7.1 Add unit tests for citation storage and retrieval
- [x] 7.2 Add integration tests for citation validation pipeline
- [x] 7.3 Add regression tests for citation display in search results

## 8. Documentation

- [x] 8.1 Update CHANGELOG.md
- [x] 8.2 Update README with citation feature documentation
