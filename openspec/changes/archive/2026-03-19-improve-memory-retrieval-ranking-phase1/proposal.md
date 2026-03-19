## Why

Current retrieval uses a single weighted-sum score (`vector + BM25`) and ignores already-stored recency and importance metadata during ranking. This causes unstable ranking quality in mixed query types and misses low-cost relevance gains that can be delivered without changing storage architecture.

## What Changes

- Replace weighted-sum hybrid fusion with rank-based reciprocal rank fusion (RRF) for vector and BM25 candidate lists.
- Add configurable recency boost and importance weighting in the final retrieval score.
- Extend retrieval configuration contract with phase-1 ranking controls (RRF constant, recency half-life, recency toggle, importance weight).
- Add regression coverage to verify ranking order behavior for RRF + recency + importance paths.

## Capabilities

### New Capabilities
- `memory-retrieval-ranking-phase1`: Defines phase-1 ranking pipeline behavior (RRF fusion, recency boost, importance weighting) and ranking-specific acceptance scenarios.

### Modified Capabilities
- `memory-auto-capture-and-recall`: Retrieval requirements change from weighted-sum-only ranking to configurable phase-1 ranking pipeline behavior.
- `memory-provider-config`: Retrieval config requirements expand to include ranking-phase controls and defaults.

## Impact

- Affected code: `src/store.ts`, `src/config.ts`, `src/types.ts`, `src/index.ts` (if search API shape changes), and retrieval-related tests.
- Affected behavior: memory ranking order in automatic recall and `memory_search` tool output.
- Backward compatibility: existing retrieval mode remains supported; new controls default to enabled-safe values for phase-1 ranking.
