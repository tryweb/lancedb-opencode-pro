## MODIFIED Requirements

### Requirement: Hybrid retrieval for context injection
The system MUST support hybrid retrieval combining vector similarity and BM25 lexical matching with reciprocal rank fusion (RRF) and configurable ranking controls, and the project MUST provide a retrieval-quality workflow that measures ranked-result quality against documented thresholds.

#### Scenario: Hybrid retrieval returns ranked matches
- **WHEN** user submits a new troubleshooting prompt with memory provider enabled in hybrid mode
- **THEN** the system computes vector and BM25 candidates, applies RRF fusion plus configured recency and importance ranking controls, and returns ranked memories for context injection

#### Scenario: Retrieval quality workflow reports recall metrics
- **WHEN** maintainers run the retrieval-quality workflow against the defined query set
- **THEN** the workflow reports recall and robustness metrics that can be compared with the documented release thresholds
