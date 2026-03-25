# memory-auto-capture-and-recall Specification Delta

## Purpose

TBD - created by archiving change add-lancedb-memory-provider. Update Purpose after archive.

## MODIFIED Requirements

### Requirement: Hybrid retrieval for context injection

The system MUST support hybrid retrieval combining vector similarity and BM25 lexical matching with reciprocal rank fusion (RRF) and configurable ranking controls, and the project MUST provide a retrieval-quality workflow that measures ranked-result quality against documented thresholds.

The system MUST apply injection control configuration to determine how many memories to inject and whether to summarize content.

#### Scenario: Hybrid retrieval returns ranked matches
- **WHEN** user submits a new troubleshooting prompt with memory provider enabled in hybrid mode
- **THEN** the system computes vector and BM25 candidates, applies RRF fusion plus configured recency and importance ranking controls, and returns ranked memories for context injection

#### Scenario: Retrieval quality workflow reports recall metrics
- **WHEN** maintainers run the retrieval-quality workflow against the defined query set
- **THEN** the workflow reports recall and robustness metrics that can be compared with the documented release thresholds

#### Scenario: Injection respects token budget in budget mode
- **WHEN** `injection.mode` is "budget" and memories are retrieved for injection
- **THEN** the system estimates token count for each memory
- **AND** accumulates memories until `budgetTokens` is reached
- **AND** stops before exceeding the budget

#### Scenario: Injection applies summarization when configured
- **WHEN** `injection.summarization` is not "none" and memory content exceeds thresholds
- **THEN** the system applies the configured summarization strategy
- **AND** injects the summarized content into the system prompt

#### Scenario: Injection respects minimum memories floor
- **WHEN** injection would stop before `minMemories` due to budget or score drop
- **THEN** the system continues injecting until `minMemories` memories are injected
- **AND** respects `injectionFloor` threshold