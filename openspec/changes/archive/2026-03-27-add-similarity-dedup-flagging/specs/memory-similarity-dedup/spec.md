# memory-similarity-dedup Specification

## Purpose

Add similarity-based deduplication flagging to the memory capture pipeline. When a new memory candidate is processed, the system SHALL check its semantic similarity against existing memories in the same scope before writing. If similarity exceeds the configured threshold, the memory is written with duplicate metadata but the write is NOT blocked.

## ADDED Requirements

### Requirement: Write-path similarity flagging

After a memory candidate passes extraction and embedding in `flushAutoCapture()`, the system SHALL perform a scope-internal vector similarity search using the new memory's embedding. The system SHALL write the memory regardless of the similarity result, but SHALL populate `metadataJson.isPotentialDuplicate` and `metadataJson.duplicateOf` when similarity to the most similar existing memory meets or exceeds `dedup.writeThreshold`.

#### Scenario: Similar memory found during capture
- **WHEN** `flushAutoCapture()` processes a new memory candidate and the scope-internal similarity search returns a top score >= `dedup.writeThreshold`
- **THEN** the system writes the memory record with `metadataJson` containing `"isPotentialDuplicate": true` and `"duplicateOf": "<id of most similar memory>"`, and records a `capture` event with `outcome: "stored"` and `skipReason: "duplicate-similarity"`

#### Scenario: No similar memory found during capture
- **WHEN** `flushAutoCapture()` processes a new memory candidate and the scope-internal similarity search returns a top score < `dedup.writeThreshold`, or returns no results
- **THEN** the system writes the memory record with `metadataJson` containing `"isPotentialDuplicate": false`, and records a `capture` event with `outcome: "stored"` (no skip reason)

#### Scenario: Dedup disabled via configuration
- **WHEN** `dedup.enabled` is `false`
- **THEN** the system skips the similarity check entirely, writes the memory with `"isPotentialDuplicate": false`, and records a standard `capture` event with `outcome: "stored"`

#### Scenario: Embedder unavailable during dedup check
- **WHEN** the similarity check is attempted but the embedder returns an empty vector or throws an error
- **THEN** the system writes the memory with `"isPotentialDuplicate": false` and `"duplicateOf": null`, and records a standard `capture` event with `outcome: "stored"` (dedup failure does not block capture)

#### Scenario: Empty scope during dedup check
- **WHEN** the active scope contains zero existing memories at the time of similarity check
- **THEN** the system writes the memory with `"isPotentialDuplicate": false` and `"duplicateOf": null`, and records a standard `capture` event with `outcome: "stored"`

### Requirement: Configurable dedup thresholds

The system SHALL support configurable dedup thresholds via environment variables and sidecar config, following the existing config resolution precedence. The system SHALL use safe defaults when config keys are absent.

#### Scenario: Default threshold values
- **WHEN** no `dedup.writeThreshold` is configured
- **THEN** the system SHALL use `0.92` as the default value

#### Scenario: Environment variable override
- **WHEN** the environment variable `LANCEDB_OPENCODE_PRO_DEDUP_WRITE_THRESHOLD` is set to a valid float between `0.0` and `1.0`
- **THEN** the system SHALL use that value as `dedup.writeThreshold`, overriding any sidecar config value

#### Scenario: Sidecar config override
- **WHEN** the sidecar file `lancedb-opencode-pro.json` contains `{"dedup": {"writeThreshold": 0.95}}`
- **THEN** the system SHALL merge this with existing config, and environment variables SHALL take precedence over sidecar values

#### Scenario: Invalid threshold clamped to safe range
- **WHEN** the configured `dedup.writeThreshold` is less than `0.0` or greater than `1.0`
- **THEN** the system SHALL clamp the value to the range `[0.0, 1.0]`
