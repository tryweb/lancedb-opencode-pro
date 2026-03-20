# memory-validation-harness Specification

## Purpose
TBD - created by archiving change add-memory-validation-harness. Update Purpose after archive.
## Requirements
### Requirement: Layered validation workflows
The project MUST provide executable validation workflows separated into foundation correctness, regression safety, retrieval quality, and performance benchmarking layers.

#### Scenario: Developer runs foundation validation
- **WHEN** a developer executes the foundation validation workflow
- **THEN** the project verifies core storage correctness behaviors including persistence, scope isolation, and vector compatibility without requiring benchmark-scale data generation

#### Scenario: Developer runs benchmark validation
- **WHEN** a developer executes the benchmark validation workflow
- **THEN** the project reports retrieval-quality or latency metrics separately from the core pass/fail correctness suite

### Requirement: Docker-aligned verification entrypoints
The project MUST expose validation entrypoints that can be executed through the documented Docker workflow.

#### Scenario: Containerized release-readiness validation
- **WHEN** an operator starts the documented Docker environment and invokes the validation commands from inside the application container
- **THEN** the project runs the same supported verification workflows used for release-readiness checks

### Requirement: Acceptance evidence mapping
The project MUST map executable validation workflows to the documented acceptance and validation checklist items.

#### Scenario: Release checklist review
- **WHEN** a maintainer reviews release readiness after running validation workflows
- **THEN** the maintainer can determine which acceptance items are covered by automated evidence and which remain manual or unresolved

### Requirement: Effectiveness reporting workflow
The project MUST provide a documented workflow for generating long-memory effectiveness summaries from recorded runtime events in the supported local or Docker verification environment.

#### Scenario: Operator runs effectiveness report in Docker workflow
- **WHEN** an operator starts the documented Docker environment and invokes the effectiveness reporting entrypoint
- **THEN** the project generates a machine-readable effectiveness summary suitable for release review or tuning analysis

### Requirement: Effectiveness evidence in release review
The project MUST document how effectiveness metrics and feedback counts are reviewed alongside existing retrieval and latency validation evidence.

#### Scenario: Maintainer reviews release readiness with effectiveness data
- **WHEN** a maintainer evaluates release readiness after running validation and reporting workflows
- **THEN** the maintainer can inspect both offline retrieval metrics and online effectiveness summaries in one documented review path

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

