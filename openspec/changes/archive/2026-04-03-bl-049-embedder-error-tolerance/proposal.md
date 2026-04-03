# Proposal: BL-049 Embedder Error Tolerance and Graceful Degradation

## Why

When the embedder (Ollama/OpenAI) is unreachable, times out, or returns invalid responses, the entire memory system becomes non-operational. This blocks both auto-capture and search functionality. Users must manually restart services or reconfigure, which creates poor UX. The system already has BM25 fallback for lexical search, but no structured retry/backoff or graceful degradation when embedder fails during vector operations.

## What Changes

- Add configurable retry with exponential backoff for embedder failures (timeout, HTTP errors, network issues)
- Add automatic fallback to BM25-only search when vector embedding fails after retry exhaustion
- Add structured warning logs and metrics for embedder degradation events
- Expose current search mode (vector, hybrid, bm25-only) in `memory_stats`

## Capabilities

### New Capabilities

- **embedder-retry**: Retry with exponential backoff when embedder fails (timeout, network, HTTP errors)
- **bm25-fallback**: Automatic BM25-only search fallback when embedder is unavailable after retry exhaustion
- **embedder-health-metrics**: Metrics and logs for embedder availability, retry counts, fallback events

### Modified Capabilities

- `memory-stats`: Extend to expose `searchMode: "vector" | "hybrid" | "bm25-only"` and embedder health status

## Impact

- **Affected modules**: `src/embedder.ts`, `src/store.ts`, `src/tools/memory.ts`, `src/config.ts`
- **Configuration**: Add `embedding.retry.enabled`, `embedding.retry.maxAttempts`, `embedding.retry.initialDelayMs`, `embedding.retry.backoffMultiplier`
- **Dependencies**: None new (existing fetch + logging infrastructure)
