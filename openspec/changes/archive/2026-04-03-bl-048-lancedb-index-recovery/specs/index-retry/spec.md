## ADDED Requirements

### Requirement: Index retry with exponential backoff

The system SHALL retry failed index creation attempts with exponential backoff before marking the index as permanently failed.

Runtime Surface: internal-api
Entrypoint: `src/store.ts` -> `MemoryStore.ensureIndexes()`

#### Scenario: Vector index creation succeeds on retry
- **WHEN** a vector index creation fails due to transient conflict (first attempt), but succeeds on retry
- **THEN** the system SHALL mark `indexState.vector = true` and log success

#### Scenario: Vector index creation fails after all retries
- **WHEN** all retry attempts (3) for vector index creation fail
- **THEN** the system SHALL mark `indexState.vector = false` with structured error logged, and continue operation with fallback

#### Scenario: FTS index creation succeeds on retry
- **WHEN** an FTS index creation fails due to transient conflict, but succeeds on retry
- **THEN** the system SHALL mark `indexState.fts = true` and log success

---

### Requirement: Index existence check before creation

The system SHALL check if an index already exists before attempting to create it, to prevent unnecessary conflicts.

Runtime Surface: internal-api
Entrypoint: `src/store.ts` -> `MemoryStore.ensureIndexes()`

#### Scenario: Index already exists
- **WHEN** `table.index(indexName)` returns a valid index object
- **THEN** the system SHALL skip creation and mark index as enabled (`indexState.vector = true`)

#### Scenario: Index does not exist
- **WHEN** `table.index(indexName)` returns null/undefined
- **THEN** the system SHALL proceed with index creation (with retry logic)

---

### Requirement: Structured logging for index operations

The system SHALL log structured information about index creation attempts for observability.

Runtime Surface: internal-api
Entrypoint: `src/store.ts` -> `MemoryStore.ensureIndexes()`

#### Scenario: Index creation attempted
- **WHEN** the system attempts to create an index
- **THEN** log a structured message with: index name, attempt number, outcome

#### Scenario: Index creation fails
- **WHEN** an index creation attempt fails
- **THEN** log an error with: index name, attempt number, error message, whether retries will be attempted

---

### Requirement: Fallback to in-memory search when indexes unavailable

The system SHALL continue to operate even when vector/fts indexes are unavailable by using in-memory fallback.

Runtime Surface: internal-api
Entrypoint: `src/store.ts` -> `MemoryStore.searchMemories()`

#### Scenario: Vector index unavailable
- **WHEN** `indexState.vector = false` 
- **THEN** the system SHALL fall back to in-memory cosine similarity search without error

#### Scenario: FTS index unavailable
- **WHEN** `indexState.fts = false`
- **THEN** the system SHALL fall back to vector-only search without error
