# Implementation Tasks

## Tasks

- [x] Add ScopeCacheConfig interface to src/store.ts (maxScopes, maxRecordsPerScope, enabled)
- [x] Extend ScopeCache interface with lastAccessTimestamp field
- [x] Add CacheStats interface (hits, misses, evictions) to src/store.ts
- [x] Implement LRU eviction logic in getCachedScopes()
- [x] Add bounds enforcement (maxRecordsPerScope truncation by timestamp)
- [x] Add cache stats tracking (increment on hit/miss/eviction)
- [x] Update MemoryStore constructor to accept cacheConfig option
- [x] Add unit tests for LRU eviction behavior
- [x] Add unit tests for bounds enforcement
- [x] Add unit tests for cache stats

## Verification Matrix

| Requirement | Unit | Integration | E2E | Required to release |
|---|---|---|---|---|
| R1: Cache respects max scopes bound | ✅ | ❌ | n/a | yes |
| R2: Cache respects max records per scope bound | ✅ | ❌ | n/a | yes |
| R3: Configurable bounds via constructor options | ✅ | ❌ | n/a | yes |
| R4: LRU tracking on cache access | ✅ | ❌ | n/a | yes |
| R5: Fallback to non-cached computation | ✅ | ❌ | n/a | yes |

## Changelog Wording Class

internal-only — This change optimizes internal memory management without exposing new user-facing capabilities.