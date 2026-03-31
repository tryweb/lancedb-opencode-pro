## Context

`ScopeCache` (in `src/store.ts:32-37`) currently stores:
- `records: MemoryRecord[]` — full memory objects
- `tokenized: string[][]` — tokenized text arrays
- `idf: Map<string, number>` — IDF weights
- `norms: Map<string, number>` — vector norms

The `scopeCache` Map (`src/store.ts:62`) grows unbounded as users query additional scopes. Used in `getCachedScopes` (`src/store.ts:1016`) for TF-IDF scoring during retrieval.

## Goals / Non-Goals

**Goals:**
- Add configurable memory bounds (max scopes, max records)
- Implement LRU eviction when bounds exceeded
- Provide cache stats (hits, misses, evictions) for observability
- Graceful fallback to non-cached computation

**Non-Goals:**
- Not exposing cache as user-facing API/tool
- Not changing retrieval semantics (same results)
- Not adding persistence layer for cache

## Decisions

| Decision | Choice | Why | Trade-off |
|---|---|---|---|
| Eviction policy | LRU (Least Recently Used) | Simple, proven, works well for temporal access patterns | May evict frequently accessed scope if not recently used |
| Bound type | Configurable max scopes + max records per scope | Allows fine-grained control per use case | Requires configuration tuning |
| Cache stats | Internal API (not plugin tool) | Lower blast radius; can be extended later | No direct user visibility |
| Fallback behavior | On-demand recomputation | Preserves correctness; no data loss | Slight latency on cache miss |

## Risks / Trade-offs

- **[Risk]** Large scope causes memory spike during initial load → **[Mitigation]** Add max records per scope bound
- **[Risk]** Too aggressive eviction reduces cache hit rate → **[Mitigation]** Default to generous bounds; allow tuning
- **[Risk]** Cache stats add overhead → **[Mitigation]** Use lazy counters, only compute on explicit query

## Migration Plan

1. Add cache config interface with defaults (maxScopes: 10, maxRecordsPerScope: 1000)
2. Implement LRU tracking (access timestamp or order)
3. Add eviction logic in `getCachedScopes` before adding new entry
4. Add stats object with hit/miss/eviction counters
5. Add unit tests for eviction and bounds