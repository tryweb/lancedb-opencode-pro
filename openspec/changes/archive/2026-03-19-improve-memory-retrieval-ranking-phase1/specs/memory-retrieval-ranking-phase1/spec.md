## ADDED Requirements

### Requirement: Phase-1 ranking pipeline with RRF, recency, and importance
The system MUST support a phase-1 retrieval ranking pipeline that fuses vector and BM25 channels using reciprocal rank fusion (RRF), then applies recency and importance multipliers before final ranking output.

#### Scenario: RRF fusion combines lexical and semantic ranks
- **WHEN** a retrieval query produces vector and BM25 candidate rankings for the active scope set
- **THEN** the system computes a fused ranking score using RRF with the configured constant and returns results sorted by fused score descending

#### Scenario: Recency boost prefers fresher memories
- **WHEN** two memories have equivalent base fused relevance but different timestamps
- **THEN** the newer memory receives a higher final score when recency boost is enabled

#### Scenario: Importance weighting influences final ordering
- **WHEN** two memories have equivalent fused relevance and recency factors but different stored importance values
- **THEN** the higher-importance memory receives a higher final score when importance weighting is enabled

#### Scenario: Safety filters remain in effect
- **WHEN** retrieval processes candidate memories under phase-1 ranking
- **THEN** scope filtering, vector-dimension compatibility filtering, and minimum-score threshold filtering continue to apply before output
