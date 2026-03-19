## Context

The current project records capture, recall, and explicit feedback events, then exposes those aggregates through `memory_effectiveness`. This is useful for system-health visibility, but the interaction model is heavily background-driven: auto-capture happens without explicit user action, recall injection happens inside the system prompt, and users usually do not see which memory ids were involved unless they inspect raw memory output. As a result, explicit feedback counts are structurally sparse.

The design challenge is not to replace event metrics, but to redefine how maintainers interpret them. In a low-feedback environment, the project needs a framework that treats explicit feedback as optional high-value evidence while using behavior-based proxy metrics and periodic sample audits as the primary source of product-value assessment.

## Goals / Non-Goals

**Goals:**
- Define a low-feedback evaluation model that separates system-health metrics from user-value metrics.
- Establish proxy metrics that can be reviewed even when `memory_feedback_*` usage is near zero.
- Define sample-audit workflows so maintainers can validate capture and recall quality without requiring continuous user labeling.
- Clarify summary interpretation rules so zero feedback is treated as unknown quality, not success.

**Non-Goals:**
- Redesigning the existing event schema in this change.
- Guaranteeing fully automatic ground-truth measurement of memory usefulness.
- Replacing explicit feedback commands; they remain useful when available.
- Implementing dashboards or analytics infrastructure in this design-only change.

## Decisions

### Decision: Split effectiveness interpretation into system health and product value
The framework will define two separate evaluation layers.

- **System health**: capture success, skip reasons, recall hit rate, recall injection rate.
- **Product value**: repeated-context reduction, clarification burden reduction, manual memory rescue rate, correction-signal rate, and sampled recall usefulness.

Rationale:
- Existing metrics already describe whether the memory pipeline is operational.
- Users need a distinct lens for judging whether memory changed interaction cost in a beneficial way.
- This separation prevents high recall-hit rates from being misread as evidence of usefulness.

Alternatives considered:
- Continue treating a single `memory_effectiveness` summary as a complete quality signal: rejected because it overstates certainty when user feedback is sparse.

### Decision: Treat explicit feedback as sparse high-confidence evidence, not as the main KPI source
Explicit feedback commands remain important, but low feedback volume must be interpreted as insufficient signal.

Rationale:
- Background auto-capture and background recall mean most users cannot easily observe storage or injection moments.
- Sparse feedback is therefore expected even in healthy usage.
- When explicit feedback does exist, it is still high-value evidence and should influence quality review.

Alternatives considered:
- Ignore explicit feedback entirely: rejected because it is the strongest direct signal when present.
- Treat zero feedback as zero defects: rejected because it collapses missing observability into false confidence.

### Decision: Use proxy metrics and sample audits as the default low-feedback evaluation method
Maintainers will review proxy metrics and periodic sampled sessions or events instead of waiting for large volumes of user feedback.

Rationale:
- Proxy metrics can be collected passively from real usage.
- Sample audits allow teams to inspect actual recall usefulness and skipped-capture quality with bounded effort.
- This is more realistic for a background memory system than requiring constant manual annotation.

Alternatives considered:
- Require users to rate every memory interaction: rejected as too disruptive and unlikely to succeed in CLI workflows.

## Risks / Trade-offs

- [Proxy metrics are less direct than explicit labels] -> Mitigation: keep proxy metrics paired with periodic human sample review.
- [Teams may over-interpret high recall hit rates] -> Mitigation: explicitly document that recall availability does not prove usefulness.
- [Sample audits may be inconsistent across reviewers] -> Mitigation: define a lightweight review rubric with fixed questions for captured and recalled examples.
- [Low-feedback evaluation could drift into qualitative opinions] -> Mitigation: anchor reviews in repeatable proxy metrics plus explicit audit checklists.

## Migration Plan

1. Add OpenSpec requirements and design guidance for low-feedback evaluation.
2. Update docs and reporting guidance so maintainers classify metrics into system-health and product-value layers.
3. If needed later, extend runtime tooling to compute or expose the proxy metrics defined here.

## Open Questions

- Which proxy metrics can be derived from existing event streams without adding new runtime instrumentation?
- Should sampled audits focus first on recalled memories, skipped captures, or both?
- What minimum sample size should release reviewers use before drawing quality conclusions in low-feedback projects?
