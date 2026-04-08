# opencode-v1314-verification Specification

## ADDED Requirements

### Requirement: OpenCode version is pinned in Docker environment

The project SHALL pin OpenCode version to v1.3.14 in the Docker test environment to ensure reproducible testing and alignment with SDK version.

#### Scenario: Dockerfile specifies OpenCode v1.3.14
- **WHEN** Dockerfile.opencode is built
- **THEN** the resulting Docker image contains OpenCode v1.3.14 exactly

#### Scenario: Docker build produces consistent image
- **WHEN** `docker compose build --no-cache` is executed
- **THEN** the build deterministically installs OpenCode v1.3.14 without relying on latest

### Requirement: SDK dependencies match OpenCode version

The project SHALL update both `@opencode-ai/plugin` and `@opencode-ai/sdk` dependencies to v1.3.14 to align with the Docker OpenCode version.

#### Scenario: package.json declares SDK v1.3.14
- **WHEN** package.json is inspected
- **THEN** both `@opencode-ai/plugin` and `@opencode-ai/sdk` specify version 1.3.14

#### Scenario: npm install resolves to v1.3.14
- **WHEN** `npm install` is executed
- **THEN** node_modules contains OpenCode SDK v1.3.14 artifacts

### Requirement: Full verification suite passes with v1.3.14

The project SHALL execute `npm run verify:full` successfully with OpenCode v1.3.14 to confirm compatibility.

#### Scenario: verify:full completes without errors
- **WHEN** `npm run verify:full` is executed in Docker v1.3.14 environment
- **THEN** all tests pass with exit code 0

#### Scenario: verify:full validates all test categories
- **WHEN** `npm run verify:full` is executed
- **THEN** test:foundation, test:regression, test:retrieval, and benchmark:latency all pass

### Requirement: session.idle hook triggers correctly in v1.3.14

The project SHALL validate that the `session.idle` hook triggers after AI SDK v5→v6 migration to ensure auto-capture functionality remains intact.

#### Scenario: session.idle hook triggers after session becomes idle
- **WHEN** an OpenCode session transitions to idle state in v1.3.14
- **THEN** the hook triggers and memory auto-capture executes

#### Scenario: Auto-capture writes memory to store
- **WHEN** session.idle hook triggers in v1.3.14
- **THEN** captured memory is persisted to LanceDB store

### Requirement: All17 tools execute correctly after Tool.define() fix

The project SHALL validate that all 17 custom tools execute correctly after v1.3.14 Tool.define() bug fix.

#### Scenario: test:regression validates tool execution
- **WHEN** `npm run test:regression` is executed with v1.3.14
- **THEN** all 17 tools pass their execution tests

#### Scenario: Tool execute wrapper no longer duplicates
- **WHEN** a tool is invoked in v1.3.14
- **THEN** the execute function is wrapped exactly once (not multiple times)

### Requirement: End-to-end write-restart-search flow works in v1.3.14

The project SHALL validate the complete memory lifecycle (write → restart → search) works correctly in v1.3.14.

#### Scenario: test:e2e validates complete flow
- **WHEN** `npm run test:e2e` is executed with v1.3.14
- **THEN** the test passes, confirming write, restart, and search operations work end-to-end

#### Scenario: Memory persists across restart
- **WHEN** memory is written in v1.3.14 environment
- **AND** OpenCode server is restarted
- **THEN** the memory is searchable via memory_search tool

### Requirement: Compatibility status is documented

The project SHALL update `docs/OPENCODE_COMPATIBILITY.md` with v1.3.14 verification results and behavior notes.

#### Scenario: Compatibility matrix includes v1.3.14 entry
- **WHEN** OPENCODE_COMPATIBILITY.md is inspected
- **THEN** v1.3.14 is listed with status "✅ Verified" or "⚠️ Known Issues" with details

#### Scenario: Behavior changes are documented
- **WHEN** v1.3.14 introduces behavior differences from v1.2.25
- **THEN** those differences are documented in OPENCODE_COMPATIBILITY.md