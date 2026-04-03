# bm25-fallback Specification

## Purpose
TBD - created by archiving change bl-049-embedder-error-tolerance. Update Purpose after archive.
## Requirements
### Requirement: Automatic BM25-only search fallback when embedder unavailable

The system SHALL fall back to BM25-only search when embedder is unavailable after retry exhaustion.

Runtime Surface: hook-driven  
Entrypoint: src/store.ts -> search() fallback branch

#### Scenario: Fallback to BM25 when embedder fails

- **WHEN** embedder has failed after max retry attempts and memory_search is invoked
- **THEN** system detects embedder unavailable and switches to BM25-only search mode

#### Scenario: Hybrid search normalizes to BM25-only

- **WHEN** config has retrieval.mode: hybrid and embedder is unavailable
- **THEN** effective weights normalize to vectorWeight: 0, bm25Weight: 1.0

#### Scenario: Embedder recovers mid-session

- **WHEN** embedder was unavailable and subsequent embed() call succeeds
- **THEN** system returns to normal vector/hybrid mode

