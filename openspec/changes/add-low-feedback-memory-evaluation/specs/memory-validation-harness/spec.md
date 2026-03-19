## ADDED Requirements

### Requirement: Low-feedback review guidance
The project MUST document a validation and review workflow for low-feedback environments that combines runtime summaries, proxy metrics, and sampled audits.

#### Scenario: Maintainer reviews release readiness with sparse user feedback
- **WHEN** maintainers review long-memory effectiveness and explicit feedback counts are sparse
- **THEN** the documented workflow instructs them to review proxy metrics and sampled audits instead of relying on feedback totals alone

### Requirement: Proxy-metric evidence mapping
The project MUST map low-feedback proxy metrics and sample-audit expectations into the effectiveness review process.

#### Scenario: Team evaluates whether memory reduced interaction cost
- **WHEN** the team asks whether long memory helped in real OpenCode usage
- **THEN** the review path includes evidence for reduced repeated context, reduced clarification burden, reduced manual rescue behavior, or stable correction-signal rates
