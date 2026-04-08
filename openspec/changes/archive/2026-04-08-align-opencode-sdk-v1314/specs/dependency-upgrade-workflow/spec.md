# dependency-upgrade-workflow Specification (Modified for OpenCode SDK)

## MODIFIED Requirements

### Requirement: Weekly OpenCode SDK version check

The project MUST provide a scheduled GitHub Actions workflow that checks for available OpenCode SDK version updates on a weekly basis.

#### Scenario: Weekly check runs on schedule
- **WHEN** the scheduled weekly check runs
- **THEN** the workflow compares current OpenCode SDK version in package.json against the latest published version on npm

#### Scenario: OpenCode SDK version delta detected
- **WHEN** a newer OpenCode SDK version is available
- **THEN** the workflow reports the version delta and initiates compatibility verification

### Requirement: OpenCode SDK compatibility verification

The project MUST verify OpenCode SDK compatibility before recommending an upgrade by running the full test suite against the candidate version in an isolated Docker environment.

#### Scenario: Docker environment uses candidate SDK version
- **WHEN** an OpenCode SDK update is available
- **THEN** the workflow builds a Docker image with the candidate OpenCode version pinned in Dockerfile.opencode

#### Scenario: Compatibility verification includes hook validation
- **WHEN** OpenCode SDK compatibility verification runs
- **THEN** the workflow executes test:foundation to validate session.idle and event hooks
- **AND** the workflow executes test:regression to validate all 17 tool execute behaviors
- **AND** the workflow executes test:e2e to validate end-to-end memory lifecycle

#### Scenario: Compatibility test passes with v1.3.14 specifics
- **WHEN** verification tests pass with v1.3.14
- **THEN** the workflow confirms:
  - session.idle hook triggers correctly after AI SDKv6 migration
  - Tool.execute behavior is correct after Tool.define() bug fix
  - End-to-end memory flow works without regression

#### Scenario: Compatibility test fails
- **WHEN** any verification test fails with the candidate OpenCode version
- **THEN** the workflow reports the failure with detailed error logs
- **AND** does NOT create an upgrade issue

### Requirement: Automated issue creation for OpenCode SDK upgrades

The project MUST create a GitHub issue when an OpenCode SDK update passes compatibility testing.

#### Scenario: Issue created for compatible OpenCode SDK update
- **WHEN** an OpenCode SDK update is available and passes compatibility testing
- **THEN** the workflow creates a GitHub issue with:
  - Current and target SDK versions
  - Breaking changes or migration notes (e.g., AI SDK v5→v6)
  - Verification evidence (test results)
  - Actionable upgrade checklist

#### Scenario: Duplicate OpenCode SDK issue prevention
- **WHEN** an OpenCode SDK upgrade issue already exists and is open
- **THEN** the workflow does NOT create a duplicate issue

### Requirement: Breaking changes documentation for OpenCode SDK

The project MUST document OpenCode SDK breaking changes that affect plugin functionality.

#### Scenario: Breaking changes are identified and documented
- **WHEN** an OpenCode SDK version contains breaking changes
- **THEN** the workflow identifies affected plugin components (hooks, tools, APIs)
- **AND** documents migration steps or workarounds in OPENCODE_COMPATIBILITY.md

#### Scenario: AI SDK migration risks are assessed
- **WHEN** OpenCode SDK upgrade involves AI SDK major version change (e.g., v5→v6)
- **THEN** the workflow specifically validates affected hooks:
  - session.start/end/idle/compacted
  - experimental.text.complete
  - experimental.chat.system.transform
  - All tool hooks

#### Scenario: Tool.define() bug fix impact is documented
- **WHEN** OpenCode SDK v1.3.14+ is evaluated
- **THEN** the documentation notes Tool.define() execute wrapping behavior change
- **AND** verifies all 17 custom tools execute correctly