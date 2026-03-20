## MODIFIED Requirements

### Requirement: Quantitative effectiveness summaries
The system MUST support quantitative summaries for long-memory effectiveness that combine capture funnel, recall funnel, and feedback-confirmed quality signals, and the project MUST define how those summaries are interpreted when explicit feedback is sparse.

#### Scenario: Operator requests effectiveness summary
- **WHEN** an operator runs the documented effectiveness reporting workflow
- **THEN** the system returns machine-readable summary fields for capture success, skip reasons, recall hit rate, helpful recall rate, false-positive rate, and false-negative rate

#### Scenario: Summary distinguishes operational and product metrics
- **WHEN** effectiveness metrics are reported
- **THEN** the report separates operational indicators from product-outcome proxies such as repeated-context reduction or manual-search-after-recall rate

#### Scenario: Zero feedback is interpreted as unknown quality
- **WHEN** explicit feedback counts are zero or too sparse to support statistical confidence
- **THEN** maintainers treat feedback-derived rates as insufficient evidence rather than as confirmation that memory quality is good
