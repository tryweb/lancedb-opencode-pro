# Tasks: BL-049 Embedder Error Tolerance

## Implementation Tasks

- [x] Add retry config to `EmbeddingConfig` type (`src/types.ts`)
- [x] Add retry config parsing in `src/config.ts`
- [x] Implement `embedWithRetry()` wrapper in `src/embedder.ts`
- [x] Update `src/store.ts` to catch embedder errors and trigger fallback
- [x] Extend `memory_stats` output with `searchMode` and `embedderHealth` in `src/tools/memory.ts`
- [x] Add unit tests for retry logic in `src/embedder.test.ts`
- [x] Add integration test for fallback flow

## Verification Matrix

| Requirement | Unit | Integration | E2E | Required to release |
|---|---|---|---|---|
| R1: Embedder retry with backoff | ✅ | ✅ | n/a | yes |
| R2: BM25 fallback when retry exhausted | ✅ | ✅ | n/a | yes |
| R3: Embedder health in memory_stats | ✅ | ✅ | n/a | yes |
| R4: Graceful degradation (vector→hybrid→bm25) | ✅ | ✅ | n/a | yes |
| R5: Observability (logs + stats) | ✅ | n/a | n/a | yes |

## Changelog Wording Class

`internal-only` — This is a foundation/internal improvement. Users benefit from improved reliability but the feature is not exposed as a user-facing tool. Changelog should note: "Improved embedder error handling and automatic fallback to BM25 search when embedding service is unavailable."
