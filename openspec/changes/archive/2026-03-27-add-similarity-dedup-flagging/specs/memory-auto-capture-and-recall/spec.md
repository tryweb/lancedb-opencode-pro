# memory-auto-capture-and-recall Specification (Delta)

## Purpose

Delta spec documenting the addition of similarity-based duplicate flagging to the capture pipeline. This changes the `Capture and recall evaluation signals` requirement to include duplicate-related observable outcomes.

## MODIFIED Requirements

### Requirement: Capture and recall evaluation signals

**FROM:**
> The system MUST emit structured evaluation signals during capture and recall flows so maintainers can diagnose why memories were stored, skipped, or not retrieved.

**TO:**
> The system MUST emit structured evaluation signals during capture and recall flows so maintainers can diagnose why memories were stored, skipped, or not retrieved. The system SHALL record duplicate-related outcomes (duplicate-similarity, duplicate-exact) as capture events with `outcome: "stored"` and `skipReason` set accordingly.

#### Scenario: Auto-capture skipped for a known reason
**unchanged**
- **WHEN** auto-capture does not persist a memory candidate because of minimum-length rejection, extraction rejection, initialization failure, or embedding failure
- **THEN** the system records the skip outcome with a normalized reason label suitable for aggregation

#### Scenario: Auto-capture stores memory with duplicate similarity flag
- **WHEN** auto-capture processes a new memory candidate and the scope-internal similarity search returns a top score >= `dedup.writeThreshold`
- **THEN** the system records a `capture` event with `outcome: "stored"`, `skipReason: "duplicate-similarity"`, and `memoryId` pointing to the newly stored record

#### Scenario: Recall produces ranked results
**unchanged**
- **WHEN** recall executes for a user prompt
- **THEN** the system records the query scope, result count, and whether any memory block was injected into prompt context

### Requirement: Duplicate metrics in effectiveness summary

The `EffectivenessSummary` SHALL include a `duplicates` section containing `flaggedCount` (total memories written with `isPotentialDuplicate: true`) and `consolidatedCount` (total memories merged via consolidation).

#### Scenario: Effectiveness summary includes duplicate metrics
- **WHEN** `memory_effectiveness` is called for a scope
- **THEN** the returned summary SHALL include `duplicates: { flaggedCount: number, consolidatedCount: number }` where `flaggedCount` is derived from capture events with `skipReason: "duplicate-similarity"` and `consolidatedCount` is derived from records in the scope with `metadataJson.status === "merged"`
