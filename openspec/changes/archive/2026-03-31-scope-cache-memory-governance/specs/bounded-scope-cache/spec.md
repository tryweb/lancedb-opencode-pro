# bounded-scope-cache Specification

## Purpose

Add configurable memory bounds and LRU eviction to ScopeCache to prevent unbounded memory growth while maintaining cache hit performance.

## Requirements

### Requirement: Cache respects max scopes bound

The system SHALL evict least-recently-used scope entries when the number of cached scopes exceeds the configured maximum.

Runtime Surface: internal-api
Entrypoint: src/store.ts -> getCachedScopes()

#### Scenario: Eviction triggered on scope limit
- **WHEN** `getCachedScopes` is called with a new scope and the cache already contains `maxScopes` entries
- **THEN** the least-recently-used scope entry is removed before adding the new scope
- **AND** eviction counter is incremented

#### Scenario: Within bounds - no eviction
- **WHEN** cache size is below maxScopes
- **THEN** no eviction occurs

### Requirement: Cache respects max records per scope bound

The system SHALL limit the number of records stored per scope to the configured maximum.

Runtime Surface: internal-api
Entrypoint: src/store.ts -> getCachedScopes()

#### Scenario: Record limit enforced per scope
- **WHEN** a scope contains more than `maxRecordsPerScope` records
- **THEN** only the most recent `maxRecordsPerScope` records (by timestamp) are cached

#### Scenario: Small scope - no truncation
- **WHEN** a scope has fewer than maxRecordsPerScope records
- **THEN** all records are cached

### Requirement: Configurable bounds via constructor options

The system SHALL accept cache configuration options to set maxScopes and maxRecordsPerScope.

Runtime Surface: internal-api
Entrypoint: src/store.ts -> MemoryStore constructor

#### Scenario: Default bounds applied
- **WHEN** MemoryStore is created without explicit cache config
- **THEN** default maxScopes=10 and maxRecordsPerScope=1000 are used

#### Scenario: Custom bounds applied
- **WHEN** MemoryStore is created with cacheConfig: { maxScopes: 5, maxRecordsPerScope: 500 }
- **THEN** those values are used for eviction decisions

### Requirement: LRU tracking on cache access

The system SHALL update access order on every cache read to enable accurate LRU eviction.

Runtime Surface: internal-api
Entrypoint: src/store.ts -> getCachedScopes()

#### Scenario: Recent access prevents eviction
- **WHEN** a scope is accessed via getCachedScopes
- **THEN** that scope's access timestamp is updated to current time

#### Scenario: Least recently accessed evicted first
- **WHEN** eviction is needed
- **THEN** the scope with oldest lastAccessTimestamp is removed

### Requirement: Fallback to non-cached computation

The system SHALL compute results on-demand when cache is disabled or entries are evicted.

Runtime Surface: internal-api
Entrypoint: src/store.ts -> MemoryStore methods

#### Scenario: Cache disabled returns fresh data
- **WHEN** cacheConfig.enabled is false
- **THEN** each call computes fresh data without caching

#### Scenario: Evicted scope recomputed on next access
- **WHEN** a scope was evicted due to memory pressure
- **THEN** the next access recomputes and re-caches that scope