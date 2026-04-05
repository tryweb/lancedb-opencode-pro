## ADDED Requirements

### Requirement: Commit-conflict errors trigger index re-verification

When a `createIndex` call fails with a LanceDB commit-conflict error, the system SHALL re-verify index existence before counting the attempt as a failure, because the conflict indicates a concurrent process may have successfully created the index.

Runtime Surface: internal-api
Entrypoint: `src/store.ts` -> `MemoryStore.createVectorIndexWithRetry()`, `MemoryStore.createFtsIndexWithRetry()`

#### Scenario: Commit-conflict error — index created by concurrent process
- **WHEN** `createIndex()` throws an error whose message contains `"Retryable commit conflict"` or `"preempted by concurrent transaction"`
- **AND** a subsequent `listIndices()` call shows the index now exists
- **THEN** the system SHALL mark the index state as enabled (`indexState.vector = true` or `indexState.fts = true`) and return without counting the attempt as a failure

#### Scenario: Commit-conflict error — index still absent after re-verification
- **WHEN** `createIndex()` throws a commit-conflict error
- **AND** a subsequent `listIndices()` call shows the index still does not exist
- **THEN** the system SHALL proceed to the next retry attempt (not mark as permanently failed)

#### Scenario: Non-conflict transient error — no re-verification
- **WHEN** `createIndex()` throws an error that does NOT contain a commit-conflict message
- **THEN** the system SHALL proceed with the existing retry logic unchanged (no extra `listIndices()` call)

---

### Requirement: Retry backoff includes randomized jitter

To prevent thundering-herd re-collision when multiple processes retry simultaneously, the system SHALL add randomized jitter to each retry delay.

Runtime Surface: internal-api
Entrypoint: `src/store.ts` -> `MemoryStore.createVectorIndexWithRetry()`, `MemoryStore.createFtsIndexWithRetry()`

#### Scenario: Retry delay includes jitter
- **WHEN** an index creation attempt fails and a retry delay is computed
- **THEN** the delay SHALL be `baseDelay * 2^attempt + Math.random() * baseDelay` milliseconds, where `baseDelay = 500`

#### Scenario: Jitter is non-deterministic across concurrent processes
- **WHEN** two processes compute retry delays for the same attempt number
- **THEN** their delays SHALL differ by a random amount up to `baseDelay` milliseconds, reducing the probability of simultaneous re-collision

---

### Requirement: Final existence check before declaring index failure

After exhausting all retry attempts without success, the system SHALL perform one final `listIndices()` check before writing a failure state, to prevent false-negative reporting when the last retry's conflict caused another process to succeed.

Runtime Surface: internal-api
Entrypoint: `src/store.ts` -> `MemoryStore.createVectorIndexWithRetry()`, `MemoryStore.createFtsIndexWithRetry()`

#### Scenario: Index found on final check — adopt as success
- **WHEN** all retry attempts complete without the local process succeeding
- **AND** a final `listIndices()` call shows the index now exists
- **THEN** the system SHALL mark the index state as enabled and log that the index was adopted from a concurrent process

#### Scenario: Index absent on final check — declare failure
- **WHEN** all retry attempts complete without the local process succeeding
- **AND** a final `listIndices()` call shows the index still does not exist
- **THEN** the system SHALL mark the index state as disabled and log a structured error with the last error message
