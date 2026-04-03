# Design: BL-049 Embedder Error Tolerance and Graceful Degradation

## Context

The current `src/embedder.ts` has basic timeout handling (6s default) but no retry logic. When Ollama/OpenAI is unreachable:
1. `embed()` throws immediately on timeout/network error
2. No attempt to recover automatically
3. Users get opaque errors, no fallback search capability

The codebase already has BM25 search infrastructure in `store.ts`. The missing piece is the wiring to trigger BM25-only mode when embedder fails.

## Goals / Non-Goals

**Goals:**
- Add retry with exponential backoff for embedder `embed()` calls (configurable: max 3 attempts, 1s initial, 2x backoff)
- Auto-fallback to BM25-only search after embedder retry exhaustion
- Log structured warnings on embedder failures, retries, and fallback triggers
- Expose search mode and embedder health in `memory_stats`

**Non-Goals:**
- Do NOT implement embedder health check daemon (periodic polling)
- Do NOT add automatic embedder recovery (user must restart service)
- Do NOT change vector index creation fallback logic (already exists)

## Decisions

| Decision | Choice | Why | Trade-off |
|---|---|---|---|
| Runtime surface | hook-driven | Embedder is called from store during search/capture; retry/fallback logic integrates at call site | Extra latency on first embedder failure (backoff delays) |
| Entrypoint | `src/embedder.ts` → `embedWithRetry()` wrapper | Minimal invasion; existing embedders unchanged | Slight complexity in wrapper |
| Data model | Extend `EmbeddingConfig` with retry options + add `EmbedderHealth` type | No new tables; config-only + in-memory metrics | Metrics lost on restart (acceptable) |
| Failure handling | retry → fallback → throw | Matches existing fallback philosophy in codebase | BM25-only search may have lower relevance quality |
| Observability | Console warnings + `memory_stats` fields | Already exposed via existing tool; no new UI needed | Logs only (no structured events) |

### Alternatives Considered

1. **Health check daemon**: Polling embedder periodically to detect issues early. Rejected - adds complexity, not aligned with "react to failure" model.

2. **Circuit breaker**: OpenCircuit after N failures, auto-reset after timeout. Rejected - overkill for single-user plugin; retry/backoff is sufficient.

3. **User-configurable fallback**: Allow users to choose fallback (BM25, transformers.js, none). Deferred to BL-050 (built-in embedding model).

## Operability

- **Trigger path**: User calls `memory_search` or auto-capture triggers → `embedder.embed()` fails → retry with backoff → fallback to BM25 if exhausted
- **Expected visible output**: On embedder failure: `[warn] Embedder failed, retry 1/3 in 1000ms...` → `[warn] Embedder unavailable, falling back to BM25-only search`
- **Misconfiguration/failure behavior**: If user sets `retry.maxAttempts: 0`, no retry; immediate fallback. If BM25 also fails (rare), throw original embedder error.

## Migration Plan

1. Add retry config to `EmbeddingConfig` type and `config.ts`
2. Create `embedWithRetry()` wrapper in `embedder.ts`
3. Update `store.ts` to catch embedder errors and trigger fallback
4. Extend `memory_stats` output with search mode and embedder health
5. Add unit tests for retry logic, integration tests for fallback flow

## Risks / Trade-offs

- **[Risk] First-time users confused by BM25-only mode** → Mitigation: Log clear message indicating fallback, include in docs
- **[Risk] Fallback reduces search relevance** → Mitigation: Document that hybrid → BM25-only has lower semantic recall
- **[Risk] Retry adds latency on slow embedder** → Mitigation: Configurable delays, expose via `memory_stats` health

## Open Questions

- Should retry also apply to `dim()` (dimension probe)? Yes, include for consistency.
- Should fallback trigger only on explicit embedder errors or also on high latency? Current: errors only. Latent is future work (BL-047 scope).
