## 1. Evaluation Event Model

- [x] 1.1 Add types and storage support for append-only memory effectiveness events and machine-readable summary outputs.
- [x] 1.2 Implement event write paths for capture considered/skipped/stored outcomes with normalized skip reasons.
- [x] 1.3 Implement event write paths for recall requested/returned/injected outcomes with scope and result-count metadata.

## 2. User Feedback Commands

- [x] 2.1 Add a missing-memory feedback command that records false-negative events with text and optional labels.
- [x] 2.2 Add a wrong-memory feedback command that records false-positive events linked to a stored memory identifier.
- [x] 2.3 Add a recall-usefulness feedback command that records whether recalled memory results were helpful.

## 3. Reporting And Validation

- [x] 3.1 Add an operator-facing reporting entrypoint that aggregates capture funnel, recall funnel, and feedback-quality metrics.
- [x] 3.2 Extend regression or validation workflows to verify event generation, feedback persistence, and summary output shape.
- [x] 3.3 Update Docker-based documentation and release-readiness evidence mapping for effectiveness reporting.
