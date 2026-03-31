## Why

The `ScopeCache` in `MemoryStore` (`src/store.ts`) currently stores complete records, tokenized text, IDF weights, and vector norms for all queried scopes without any memory bounds or eviction policy. As users work with large or many scopes, this cache grows unbounded, risking process memory exhaustion and degraded performance.

## What Changes

- Add configurable memory bounds to `ScopeCache` (max scopes / max records per scope)
- Implement LRU eviction policy to remove least-recently-used scope entries when bounds exceeded
- Add lazy initialization option (load cache only when needed for scoring)
- Expose cache stats via internal API for observability (hits, misses, evictions)
- Add gated fallback to on-demand computation when cache is disabled/evicted

### New Capabilities

- `bounded-scope-cache`: Configurable max scopes and max records with LRU eviction
- `cache-stats-api`: Internal API exposing hit/miss/eviction metrics for observability

### Modified Capabilities

- None (this is a new internal optimization)

## Impact

- **Affected**: `src/store.ts` (ScopeCache interface, getCachedScopes, scopeCache Map)
- **Risk**: Low — adding bounded memory usage, existing behavior preserved when cache enabled
- **Release**: internal-only (not exposed as user tool or API)