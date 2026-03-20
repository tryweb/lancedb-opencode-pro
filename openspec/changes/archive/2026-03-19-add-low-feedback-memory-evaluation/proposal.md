## Why

The project now records memory effectiveness events and exposes explicit feedback commands, but real OpenCode usage relies on background auto-capture and background recall. In that workflow, users rarely see which memories were stored or injected, so sparse feedback cannot be treated as proof that memory quality is good. We need a low-feedback evaluation framework that defines how operators judge memory value when explicit user reports are missing.

## What Changes

- Extend memory effectiveness evaluation to distinguish operational metrics from product-value proxies in low-feedback environments.
- Define behavior-based proxy metrics such as repeated-context reduction, clarification burden, manual memory rescue rate, and correction-signal rate.
- Define review workflows that use event summaries plus periodic sample audits instead of relying on direct feedback volume alone.
- Clarify that zero feedback counts mean insufficient signal rather than confirmed quality.

## Capabilities

### New Capabilities
- `low-feedback-memory-evaluation`: Defines how maintainers evaluate long-memory usefulness when explicit user feedback is rare or unavailable.

### Modified Capabilities
- `memory-effectiveness-evaluation`: Expand effectiveness summaries and interpretation guidance to separate system health from product value and to treat missing feedback as unknown rather than good.
- `memory-validation-harness`: Extend validation/reporting expectations so maintainers review proxy metrics and sample-audit workflows in addition to raw event totals.

## Impact

- Affected design and reporting docs will include new guidance for interpreting `memory_effectiveness` outputs under sparse-feedback conditions.
- Future implementation work may add derived metrics, review tooling, and event collection for behavior-based proxies.
- Release-readiness and evaluation practices will need to reference low-feedback proxy metrics instead of over-weighting explicit feedback counts.
