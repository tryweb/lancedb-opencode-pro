# memory-consolidation Specification

## Purpose

Provide a background consolidation mechanism that scope-internally identifies and merges memories with cosine similarity >= `dedup.consolidateThreshold`. Consolidation runs asynchronously and can also be triggered manually via the `memory_consolidate` tool. The goal is to reduce storage bloat from accumulated duplicate memories without blocking the capture pipeline.

## ADDED Requirements

### Requirement: Scope-internal consolidation

The system SHALL provide a `consolidateScope(scope, threshold)` function that scope-internally identifies memory pairs with cosine similarity >= `dedup.consolidateThreshold` and merges them by deleting the older record and updating the newer record's metadata.

#### Scenario: Consolidation merges similar memories (soft delete)
- **WHEN** `consolidateScope("project:abc123", 0.95)` is called and the scope contains two memories A and B where `cosineSimilarity(A.vector, B.vector) >= 0.95` and A.timestamp < B.timestamp
- **THEN** the system updates record A's `metadataJson` to set `"status": "merged"` and `"mergedInto": "<id of B>"`, updates record B's `metadataJson` to include `"mergedFrom": "<id of A>"`, and invalidates the scope cache. Record A is NOT physically deleted—consolidation uses soft delete to preserve audit trail.

#### Scenario: No similar memories to consolidate
- **WHEN** `consolidateScope(scope, threshold)` is called and no pair of memories within the scope has similarity >= threshold
- **THEN** the system makes no changes and returns `0`

#### Scenario: Multiple candidate pairs processed
- **WHEN** `consolidateScope(scope, threshold)` is called and there are multiple pairs of similar memories (e.g., A≈B, B≈C, but A≉C)
- **THEN** the system SHALL process all pairs in a single pass, sorting by timestamp (oldest first), and SHALL NOT delete a record that has already been marked as merged-from target

#### Scenario: Cross-session consolidation during session.compacted
- **WHEN** a `session.compacted` event fires and `dedup.enabled` is `true`
- **THEN** the system SHALL call `consolidateScope(activeScope, dedup.consolidateThreshold)` asynchronously after `flushAutoCapture()` completes, without blocking the session compaction flow

### Requirement: Consolidation safety guard

Consolidation operations SHALL be idempotent and SHALL NOT delete records that are actively being used in an ongoing recall operation.

#### Scenario: Consolidation is idempotent
- **WHEN** `consolidateScope(scope, threshold)` is called twice in succession with no new memories written between the calls
- **THEN** the second call SHALL return `0` (no changes) because all similar pairs have already been merged

#### Scenario: Recently recalled memory is not deleted during consolidation
- **WHEN** consolidation would delete record X but X was recalled within the last 5 minutes (i.e., `Date.now() - X.lastRecalled < 300_000`)
- **THEN** the system SHALL skip deleting X and SHALL NOT update its `duplicateOf` or `mergedFrom` metadata

### Requirement: Consolidation metrics

Consolidation operations SHALL record metrics about the number of pairs merged and records updated.

#### Scenario: Consolidation emits operation metrics
- **WHEN** `consolidateScope(scope, threshold)` completes
- **THEN** the system SHALL return an object containing `{ mergedPairs: number, updatedRecords: number, skippedRecords: number }` where `updatedRecords` reflects the count of records whose metadata was modified (soft-deleted source records + updated target records)

### Requirement: Merged records are excluded from recall

Records with `metadataJson.status === "merged"` SHALL be excluded from search results in both auto-recall and manual `memory_search`.

#### Scenario: Merged record not returned in search
- **WHEN** `store.search()` is called for a scope that contains a record with `metadataJson.status === "merged"`
- **THEN** the system SHALL filter out that record from the results, so it does not appear in recall injection or manual search results
