## Why

The project can already prove that long memory stores, retrieves, and performs well on synthetic validation, but it cannot yet quantify whether memory helps real users complete work with less repetition or identify when the system stored the wrong thing or missed something important. We need a first-class evaluation workflow so maintainers can measure true product value, tune capture and recall behavior with evidence, and accept user corrections as structured feedback.

## What Changes

- Add a memory-effectiveness evaluation capability that defines event-based measurement for capture, recall, usefulness, false positives, and false negatives.
- Add structured user-feedback flows so users can report memories that should have been stored, memories that should not have been stored, and recalled memories that were or were not helpful.
- Extend memory auto-capture and recall behavior to emit auditable evaluation events and capture skip reasons.
- Extend validation guidance so the project can report both offline retrieval quality and online effectiveness metrics from real usage data.

## Capabilities

### New Capabilities
- `memory-effectiveness-evaluation`: Define the event schema, quantitative metrics, reporting outputs, and feedback lifecycle used to evaluate real-world long-memory value.

### Modified Capabilities
- `memory-auto-capture-and-recall`: Add observable capture/recall event emission and documented skip-reason tracking for evaluation.
- `memory-management-commands`: Add user-facing feedback commands for missing memory, wrong memory, and recall usefulness reporting.
- `memory-validation-harness`: Expand validation coverage to include effectiveness-metric generation and operator-facing reporting expectations.

## Impact

- Affected code will include plugin hooks in `src/index.ts`, capture logic in `src/extract.ts`, memory data contracts in `src/types.ts`, and storage/reporting support in the memory store layer.
- User-facing memory tooling will expand beyond search/delete/clear/stats to include structured feedback entrypoints.
- Validation docs, regression workflows, and release-readiness evidence will need to cover online evaluation signals in addition to synthetic retrieval and latency checks.
