# embedder-health-metrics Specification

## Purpose
TBD - created by archiving change bl-049-embedder-error-tolerance. Update Purpose after archive.
## Requirements
### Requirement: Embedder health status exposed in memory_stats

The system SHALL expose embedder health status, retry counts, and current search mode via memory_stats.

Runtime Surface: opencode-tool  
Entrypoint: src/tools/memory.ts -> memory_stats

#### Scenario: Memory stats shows embedder healthy

- **WHEN** embedder is reachable and last embed succeeded
- **THEN** memory_stats returns embedderHealth.status: "healthy"

#### Scenario: Memory stats shows embedder degraded

- **WHEN** embedder failed but fallback succeeded
- **THEN** memory_stats returns embedderHealth.status: "degraded" and fallbackActive: true

#### Scenario: Memory stats exposes search mode

- **WHEN** system is in any operational state
- **THEN** memory_stats returns searchMode: "vector" | "hybrid" | "bm25-only"

#### Scenario: Memory stats tracks retry count

- **WHEN** embedder had retry attempts
- **THEN** memory_stats returns embedderHealth.retryCount

