# Spec: embedder-retry

## ADDED Requirements

### Requirement: Embedder retry with exponential backoff

The system SHALL retry embedder operations with exponential backoff when embedder fails due to timeout, network errors, or HTTP errors.

Runtime Surface: hook-driven  
Entrypoint: src/embedder.ts -> embedWithRetry()

#### Scenario: Embedder timeout triggers retry

- **WHEN** embedder is slow to respond (> timeoutMs) and memory_search calls embed()
- **THEN** first attempt fails with timeout error and system retries after initialDelayMs

#### Scenario: Embedder network error triggers retry

- **WHEN** embedder endpoint is unreachable (connection refused, DNS failure)
- **THEN** first attempt fails with network error and system retries with backoff delay

#### Scenario: Retry exhaustion triggers fallback

- **WHEN** embedder has failed maxAttempts times
- **THEN** system logs warning and signals fallback handler to use BM25-only search

#### Scenario: Retry disabled via config

- **WHEN** config has retry.maxAttempts: 0 and embedder fails
- **THEN** no retry occurs and fallback is triggered immediately
