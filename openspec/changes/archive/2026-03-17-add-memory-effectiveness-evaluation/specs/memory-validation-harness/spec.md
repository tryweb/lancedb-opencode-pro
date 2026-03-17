## ADDED Requirements

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
