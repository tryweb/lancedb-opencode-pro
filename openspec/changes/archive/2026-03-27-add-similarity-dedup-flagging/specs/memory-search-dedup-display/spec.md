# memory-search-dedup-display Specification

## Purpose

Define how `memory_search` tool results display the duplicate flag for memories written with `isPotentialDuplicate: true`. This makes duplicate observations actionable by operators and AI agents without requiring out-of-band inspection of `metadataJson`.

## ADDED Requirements

### Requirement: Duplicate marker in search results

The `memory_search` tool SHALL include a `(duplicate)` marker in the formatted output for records where `metadataJson.isPotentialDuplicate === true`.

#### Scenario: Search result shows duplicate marker
- **WHEN** `memory_search(query="nginx config", limit=5)` is called and one of the returned records has `metadataJson.isPotentialDuplicate === true`
- **THEN** the formatted output for that record SHALL include the text `(duplicate)` after the memory ID, before the text content

#### Scenario: Search result without duplicate flag shows no marker
- **WHEN** `memory_search(query="nginx config", limit=5)` is called and a returned record has `metadataJson.isPotentialDuplicate === false` or `metadataJson.isPotentialDuplicate` is absent
- **THEN** the formatted output for that record SHALL NOT include any duplicate marker

#### Scenario: Merged records excluded from search results
- **WHEN** `memory_search(query="nginx config", limit=5)` is called
- **THEN** records with `metadataJson.status === "merged"` SHALL NOT appear in the results, even if they were previously stored

### Requirement: Duplicate metadata accessible in raw results

The raw search result object (before formatting) SHALL include `isPotentialDuplicate` and `duplicateOf` fields so calling code can consume them programmatically.

#### Scenario: Raw result includes duplicate metadata
- **WHEN** `memory_search(query="nginx config", limit=5)` is called and returns records with duplicate metadata
- **THEN** the raw result objects SHALL include `isPotentialDuplicate: boolean` and `duplicateOf: string | null` fields alongside `id`, `score`, `text`, and `scope`
