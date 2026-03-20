# low-feedback-memory-evaluation Specification

## Purpose
TBD - created by archiving change add-low-feedback-memory-evaluation. Update Purpose after archive.
## Requirements
### Requirement: Low-feedback evaluation framework
The project MUST define a low-feedback evaluation framework for long-memory quality so maintainers can assess usefulness when explicit `memory_feedback_*` reports are sparse or absent.

#### Scenario: Feedback counts are sparse
- **WHEN** explicit missing, wrong, and useful feedback counts are low or zero
- **THEN** the evaluation framework treats those counts as insufficient signal rather than proof that memory quality is good

### Requirement: Product-value proxy metrics
The project MUST define product-value proxy metrics that can be reviewed alongside explicit feedback in low-feedback environments.

#### Scenario: Maintainer reviews long-memory value without direct labels
- **WHEN** maintainers evaluate memory usefulness in a workflow where capture and recall happen automatically in the background
- **THEN** they can review proxy metrics including repeated-context reduction, clarification burden, manual memory rescue rate, correction-signal rate, and sampled recall usefulness

### Requirement: Sample-audit workflow
The project MUST define a periodic sample-audit workflow for reviewing recalled memories and skipped captures under low-feedback conditions.

#### Scenario: Maintainer performs a bounded audit
- **WHEN** maintainers need to validate whether recalled memories were useful or whether skipped captures hid important information
- **THEN** the framework provides a repeatable sampled review process instead of requiring continuous user labeling

