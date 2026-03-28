## Why

Current memory records lack provenance tracking - when a memory is retrieved and used, there's no way to trace its origin (auto-captured, explicit remember, imported, etc.) or verify its validity. This prevents the system from implementing citation validation, freshness decay, and conflict detection based on source reliability.

## What Changes

- Add `citation` metadata field to `MemoryRecord` to track memory source
- Add `citationTimestamp` to track when citation was first recorded
- Add `CitationStatus` enum (verified, pending, invalid, expired) 
- Add `citationSource` field to track origin (auto-capture, explicit-remember, memory-import, external-source)
- Implement citation validation pipeline to check source validity
- Add citation metadata to search results for transparency
- Track citation chain for memories derived from other memories

## Capabilities

### New Capabilities
- `memory-citation`: Track memory provenance and source with verification status
- `citation-validation`: Pipeline to verify citation validity and freshness

### Modified Capabilities
- `memory-retrieval-ranking-phase1`: Add citation quality signals to ranking
- `memory-effectiveness-evaluation`: Add citation-based feedback metrics

## Impact

- **Code**: src/types.ts (MemoryRecord extension), src/store.ts (citation methods), src/index.ts (new tools)
- **Schema**: Add nullable citation fields to memories table
- **APIs**: New `memory_citation` tool for viewing/updating citations
- **Dependencies**: None (uses existing LanceDB patterns)
