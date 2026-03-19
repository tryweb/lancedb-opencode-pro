## 1. Retrieval Config Contract

- [x] 1.1 Extend retrieval runtime types and config resolution to include phase-1 ranking controls (`rrfK`, recency boost toggle, recency half-life hours, importance weight) with documented defaults.
- [x] 1.2 Add environment-variable support and validation/clamping for new phase-1 ranking controls.

## 2. Search Scoring Pipeline

- [x] 2.1 Refactor store search scoring to compute independent vector and BM25 rankings, then fuse with RRF using configured `rrfK`.
- [x] 2.2 Apply recency multiplier and importance multiplier to fused scores before threshold filtering and final ordering.
- [x] 2.3 Preserve existing scope filtering, vector-dimension compatibility filtering, and minimum-score behavior.

## 3. Verification Coverage

- [x] 3.1 Add/adjust tests that verify deterministic ranking behavior for RRF fusion across mixed lexical/semantic query fixtures.
- [x] 3.2 Add/adjust tests that verify recency and importance controls affect ranking as configured while preserving safety filters.
- [x] 3.3 Run containerized verification workflows (`typecheck`, `build`, and targeted tests) and capture pass results.
