# Changelog

All notable changes to this project will be documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/). Versions follow [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Added

- **Learning Dashboard** (`learning-dashboard-summary`, user-facing):
  - `memory_dashboard`: weekly learning effectiveness summary with trend indicators
  - Aggregates capture, recall, and feedback metrics for a configurable time window (1-90 days)
  - Week-over-week trend indicators (improving/stable/declining/insufficient-data) with minimum sample threshold
  - Rule-based actionable insights (low recall hit rate, high skip rate, low helpful rate)
  - Recent memory breakdown by category with sample previews
  - `DashboardSummary`, `TrendIndicator`, `TrendDirection` data model in `src/types.ts`

- **Learning KPI Pipeline** (`learning-kpi-pipeline`, user-facing):
  - `memory_kpi`: query learning effectiveness KPIs (retry-to-success rate, memory lift)
  - `calculateRetryToSuccessRate()`: retry-to-success metric from episodic task data
  - `calculateMemoryLift()`: lift metric comparing success rates with/without recall
  - `RetryToSuccessMetric`, `MemoryLiftMetric`, `KpiSummary` data model in `src/types.ts`

---

## [0.5.0] - 2026-03-29

### Added

- **Memory Explanation Tools** (`why-this-memory`, user-facing):
  - `memory_why`: explain why a specific memory was recalled
  - `memory_explain_recall`: explain factors behind the latest recall operation
  - `MemoryExplanation` / `RecallFactors` data model and `explainMemory()` store pathway for recency, citation, importance, and scope factors

### Changed

- **E2E Reliability**:
  - `scripts/e2e-opencode-memory.mjs` now uses deterministic mock embedding flow to keep e2e stable in both container and local environments.

- **Workflow Hardening** (internal-only):
  - Added shared Git Safety Gate guidance to `backlog-to-openspec`, `release-workflow`, and `docs/DEVELOPMENT_WORKFLOW.md`.
  - Unified no-stash rule and added failure-mode remediation tables.

### Evidence

| Feature | Spec | Code | Tests | Surface |
|---------|------|------|-------|---------|
| memory_why tool | openspec/specs/why-this-memory/spec.md#requirement-memory_why-explains-recall-factors-for-a-target-memory | src/index.ts, src/store.ts, src/types.ts | test/unit/explanation.test.ts, scripts/e2e-opencode-memory.mjs | opencode-tool |
| memory_explain_recall tool | openspec/specs/why-this-memory/spec.md#requirement-memory_explain_recall-explains-last-recall-operation | src/index.ts, src/store.ts | scripts/e2e-opencode-memory.mjs | opencode-tool |
| workflow safety gate (internal) | openspec/changes/archive/2026-03-29-why-this-memory-explanation/tasks.md | .opencode/skills/backlog-to-openspec/SKILL.md, .opencode/skills/release-workflow/SKILL.md, docs/DEVELOPMENT_WORKFLOW.md | docker compose exec opencode-dev npm run release:check | internal-only |

---

## [0.4.0] - 2026-03-28

### Added

- **Citation Model** (citation-model):
  - `CitationSource` type: `auto-capture`, `explicit-remember`, `import`, `external`
  - `CitationStatus` type: `verified`, `pending`, `invalid`, `expired`
  - Citation fields on `MemoryRecord`: `citationSource`, `citationTimestamp`, `citationStatus`, `citationChain`
  - `memory_citation` tool: View and update citation information for memories
  - `memory_validate_citation` tool: Validate citation status and update if expired
  - Citation info displayed in search results: `[source|status]` suffix
  - `validateCitation()` and `refreshExpiredCitations()` methods for citation validation
  - Auto-capture and memory_remember now set citation source automatically

---

## [0.3.0] - 2026-03-28

### Added

- **Episodic Learning Hook Wiring** (complete-episodic-learning-hooks):
  - `session.start` hook: Automatically creates task episode when session starts
  - `session.end` hook: Updates task episode state (success/failed) when session ends
  - `session.idle` hook: Extracts success patterns from completed tasks

- **Episodic Learning Tools** (user-facing):
  - `task_episode_create`: Create task episode records manually
  - `task_episode_query`: Query episodes by scope and state
  - `similar_task_recall`: Find similar past tasks using vector similarity
  - `retry_budget_suggest`: Get retry budget suggestions based on history
  - `recovery_strategy_suggest`: Get recovery strategy suggestions after failures

- **Automatic Similar Task Recall**: Enhanced `session.idle` to inject similar task context into system prompt using vector similarity

- **Vector Similarity Upgrade**: `findSimilarTasks()` now supports vector-based similarity search with fallback to keyword matching

- **Episodic Task Schema Enhancement**: Extended `EpisodicTaskRecord` to support `taskDescriptionVector` for vector-based similarity

### Evidence

| Feature | Spec | Code | Tests |
|---------|------|------|-------|
| session.start hook | hook-wiring/spec.md | src/index.ts:handleSessionStart | regression/plugin.test.ts |
| session.end hook | hook-wiring/spec.md | src/index.ts:handleSessionEnd | regression/plugin.test.ts |
| session.idle hook | hook-wiring/spec.md | src/index.ts:handleSessionIdle | regression/plugin.test.ts |
| task_episode_create | episodic-tools/spec.md | src/index.ts | unit/episodic-task.test.ts |
| task_episode_query | episodic-tools/spec.md | src/index.ts | unit/episodic-task.test.ts |
| similar_task_recall | episodic-tools/spec.md | src/index.ts, src/store.ts | unit/episodic-task.test.ts |
| retry_budget_suggest | episodic-tools/spec.md | src/index.ts, src/store.ts | - |
| recovery_strategy_suggest | episodic-tools/spec.md | src/index.ts, src/store.ts | - |

### Notes

- `tool.execute` hook NOT implemented (OpenCode plugin API limitation)
- Validation hook NOT implemented (no validation event available)
- These are documented as future enhancements in backlog

---

## [0.2.9] - 2026-03-28

### Added

- **Episodic Learning Tools** (Hook Wiring + Tools Exposure):
  - `task_episode_create`: Create task episode records manually
  - `task_episode_query`: Query episodes by scope and state
  - `similar_task_recall`: Find similar past tasks using vector similarity
  - `retry_budget_suggest`: Get retry budget suggestions based on history
  - `recovery_strategy_suggest`: Get recovery strategy suggestions after failures

- **Automatic Similar Task Recall**: Enhanced `session.idle` to inject similar task context into system prompt using vector similarity

- **Vector Similarity Upgrade**: `findSimilarTasks()` now supports vector-based similarity search with fallback to keyword matching

### Changed

- Extended `EpisodicTaskRecord` to support `taskDescriptionVector` for vector-based similarity

---

## [0.2.8] - 2026-03-28

### Fixed

- Re-publish to include actual code changes (v0.2.7 was published without new features).

---

## [0.2.7] - 2026-03-28

### Added

- **Episodic Task Schema** (BL-003): New `EpisodicTaskRecord` interface with `TaskState`, `FailureType` types for tracking task episodes.
- **Task Episode Capture** (BL-014): Methods for creating, updating, and querying task episodes.
- **Validation Outcome Ingestion** (BL-015): Parse type-check, build, and test validation results.
- **Failure Taxonomy** (BL-016): `classifyFailure()` function categorizes errors as syntax, runtime, logic, resource, or unknown.
- **Success Pattern Extraction** (BL-017): Extract command sequences and tools from successful task episodes.
- **Similar Task Recall** (BL-018): Find similar past tasks with configurable similarity threshold (0.85).
- **Retry/Recovery Evidence** (BL-019, BL-020): Track retry attempts and recovery strategies with budget suggestions.
- `addCommandToEpisode()`, `addValidationOutcome()`, `addSuccessPatterns()` store methods.
- `addRetryAttempt()`, `addRecoveryStrategy()`, `suggestRetryBudget()`, `suggestRecoveryStrategies()` store methods.
- `parseValidationOutput()` utility for parsing validation output.

### Testing

- New unit tests for episodic task CRUD operations.
- New unit tests for validation parsing and failure classification.

---

## [0.2.6] - 2026-03-27

### Fixed

- Self-merge bug in `consolidateDuplicates`: prevent `mergedFrom` from pointing to own ID when records have identical timestamps (issue #25).

---

## [0.2.5] - 2026-03-27

### Added

- Similarity-based duplicate flagging during auto-capture: new captures are checked against existing memories in the same scope using cosine similarity.
- `DedupConfig` with `enabled`, `writeThreshold` (default: 0.92), and `consolidateThreshold` (default: 0.95) for controlling dedup behavior.
- `memory_consolidate` tool: manually triggers merge of similar memories within a scope.
- `memory_consolidate_all` tool: consolidates duplicates across global and project scopes.
- `isPotentialDuplicate` and `duplicateOf` fields in `MemoryRecord.metadata` for tracking potential duplicates.
- `EffectivenessSummary.duplicates` section with `flaggedCount` and `consolidatedCount` for observability.
- `consolidateDuplicates()` store method: merges similar memory pairs where cosine similarity >= consolidateThreshold.
- Pruning preserves newest flagged duplicates when maxEntries forces deletion.

### Changed

- Capture events now include `skipReason: "duplicate-similarity"` when a new memory exceeds writeThreshold.
- `summarizeEvents()` returns counts of flagged and consolidated memories.
- Search results exclude `status=merged` records from display.

---

## [0.2.4] - 2026-03-25

### Added

- Injection control configuration for managing how recalled memories are processed before prompt injection.
- Three injection modes: `fixed` (backward-compatible default), `budget` (token-based limiting), and `adaptive` (quality-based filtering).
- Content-aware summarization: `none`, `truncate`, `extract`, and `auto` modes for reducing memory size before injection.
- Code-specific summarization with structure preservation for maintaining syntactic validity.
- Token estimation supporting Chinese, English, and code content with appropriate multipliers.
- Smart code truncation that balances brackets to preserve valid syntax.
- Key sentence extraction for text summarization.
- Configuration options: `mode`, `maxMemories`, `minMemories`, `budgetTokens`, `maxCharsPerMemory`, `summarization`, `summaryTargetChars`, `scoreDropTolerance`, `injectionFloor`, and `codeSummarization`.
- Environment variable overrides for all injection configuration options.
- Unit tests for content detection, token estimation, summarization, and injection limit calculation.

### Changed

- Memory injection now uses configurable limits instead of hardcoded `limit: 3`.
- Event metadata includes `injectionMode` and `injectionLimit` fields for observability.

---

## [0.2.3] - 2026-03-24

### Changed

- Upgraded `@lancedb/lancedb` from `0.26.2` to `0.27.1` for improved hybrid search pre-filtering and native binding compatibility (napi-rs v3).

### Added

- `dependency-update.yml` workflow: weekly scheduled check for LanceDB version updates with compatibility testing.
- `verify-matrix` job in CI: Node.js 20 and Node.js 22 compatibility testing.
- `docs/lancedb-upgrades.md`: LanceDB upgrade history and verification checklist.
- LanceDB version tracking section in CHANGELOG.md.

### CI/CD

- Dockerfile now supports `NODE_VERSION` build argument for matrix testing.
- `docker-compose.ci.yml` passes `NODE_VERSION` to Docker build.

---

## [0.2.2] - 2026-03-21

### Fixed

- `memory_scope_promote`, `memory_delete`, `memory_feedback_wrong`, `memory_feedback_useful` now accept 8-character short IDs (prefix of UUID) in addition to full 36-character UUIDs. Previously, passing a short ID always returned "not found" even though `memory_search` could find the same memory.
- `id` parameter minimum length raised from 6 to 8 characters on all memory tools.
- Fix: DELETE inside `updateMemoryScope` and `updateMemoryUsage` now uses resolved `match.id`, not the prefix argument.

---

## [0.2.1] - 2026-03-21

### Fixed

- Schema migration: databases created with v0.1.x now automatically receive the `lastRecalled`, `recallCount`, and `projectCount` columns on first startup with v0.2.x. Without this patch, any existing database would fail with a LanceDB schema error (`No field named "lastRecalled"`) on every query.

---

## [0.2.0] - 2026-03-21

### Added

- Cross-project memory scope with global scope support for sharing knowledge across projects.
- Global detection heuristic with `GLOBAL_KEYWORDS` array covering distributions, containers, orchestration, shells, databases, cloud, VCS, protocols, and package managers.
- `memory_scope_promote` tool: promote memories from project scope to global scope.
- `memory_scope_demote` tool: demote memories from global scope back to project scope.
- `memory_global_list` tool: list/search all global-scoped memories with optional unused filter.
- Usage statistics tracking: `lastRecalled`, `recallCount`, and `projectCount` fields on every memory record.
- Smart unused detection: identifies global memories not recalled within `unusedDaysThreshold` using actual recall events.
- New config options: `globalDetectionThreshold` (default: 2), `globalDiscountFactor` (default: 0.7), `unusedDaysThreshold` (default: 30).

### Changed

- Dual-scope recall: `memory_search` now queries both project and global scopes with global scores discounted by 0.7x.
- Auto-recall (system.transform) now includes global memories in context injection.
- `memory_global_list` output now includes usage statistics (stored date, last recalled, recall count, project count).

---

## [0.1.6] - 2026-03-20

### Fixed
- Patch pre-`0.1.5` `effectiveness_events` tables during store initialization so upgraded installs automatically add the missing `source` column before new recall events are written.
- Preserve backward-compatible recall summaries for upgraded databases by treating legacy rows without `source` as `"system-transform"` while allowing new `"manual-search"` events to persist normally.
- Add foundation and regression coverage for the schema-upgrade path so release verification catches missing-column failures before publish.

### Changed
- Archived and synced OpenSpec change `2026-03-20-add-effectiveness-schema-upgrade` into the main memory effectiveness specification.

---

## [0.1.5] - 2026-03-20

### Added
- `RecallSource` type to distinguish `"system-transform"` (auto recall) from `"manual-search"` (user-initiated).
- `memory_search` tool now emits a structured recall event with `source: "manual-search"` and `injected: false`.
- `EffectivenessSummary.recall` now includes `auto` and `manual` sub-structures with independent `hitRate`/`injectionRate`, plus `manualRescueRatio`.

### Changed
- `recall.hitRate` and `recall.injectionRate` top-level fields are retained as blended totals for backward compatibility; consumers that need precise breakdowns should read `recall.auto.*` and `recall.manual.*`.
- `docs/operations.md` proxy metrics table marks manual memory rescue rate as instrumented via `recall.manual.requested` and `recall.manualRescueRatio`.

---

## [0.1.4] - 2026-03-19

### Added
- Phase-1 retrieval ranking pipeline with reciprocal rank fusion (RRF), recency boost, and importance weighting controls.
- Retrieval config keys and environment overrides for `rrfK`, `recencyBoost`, `recencyHalfLifeHours`, and `importanceWeight`.
- Foundation and regression coverage for RRF scoring behavior and phase-1 ranking config defaults/overrides.
- New OpenSpec capability `memory-retrieval-ranking-phase1` with archived implementation change record.

### Changed
- Hybrid retrieval ranking now fuses vector and BM25 channels via rank-based RRF instead of direct weighted-score summation.
- Main specs for `memory-auto-capture-and-recall` and `memory-provider-config` now include phase-1 ranking requirements.
- Validation and operations docs now include low-feedback interpretation guidance and proxy-metric review workflows.

---

## [0.1.3] - 2026-03-17

### Added
- Append-only memory effectiveness events for capture, recall, and feedback auditing.
- New tools: `memory_feedback_missing`, `memory_feedback_wrong`, `memory_feedback_useful`, and `memory_effectiveness`.
- Foundation and regression coverage for event persistence, recall injection metrics, and feedback summary output.

### Changed
- `verify` now runs the dedicated `test:effectiveness` workflow before retrieval checks.
- Release and operations docs now explain how to inspect capture, recall, and feedback metrics.

---

## [0.1.2] - 2026-03-17

### Added
- OpenAI embedding provider support alongside the default Ollama flow.
- Explicit configuration validation for missing OpenAI API keys and embedding models.
- Release packaging and regression coverage for the OpenAI embedding path.

---

## [0.1.1] - 2026-03-16

### Added
- `memory_port_plan` tool: plan non-conflicting host ports for Docker Compose services across multiple projects on the same host.
- Port reservations persisted in `global` scope long-term memory, enabling cross-project conflict avoidance.
- Live TCP bind-probe check combined with remembered reservations for dual-layer conflict detection.
- Upsert semantics: re-planning a service replaces its previous reservation instead of creating duplicates.
- New core module `src/ports.ts` for reservation parsing, candidate selection, and host port availability probing.
- Regression tests covering planner output format, conflict fallback, and reservation persistence/upsert behavior.
- OpenSpec change `add-cross-project-port-registry` (archived) with proposal, design, specs, and tasks.
- New spec `cross-project-port-registry` added to `openspec/specs/`.
- README section: Compose Port Planning (Cross-Project) with input/output examples and `docker-compose.yml` mapping guide.

### Changed
- `openspec/specs/memory-management-commands/spec.md` extended with port planning command requirement and scenarios.

### Fixed
- Reservation upsert order: new record is written before deleting the old one, preventing data loss if embedding fails mid-operation.

---

## Dependency History

### LanceDB

| Version | Date | Notes |
|---------|------|-------|
| 0.27.1 | 2026-03-24 | Hybrid search pre-filtering fix, napi-rs v3, parallel inserts |
| 0.26.2 | 2026-03-16 | Initial version |

See [docs/lancedb-upgrades.md](docs/lancedb-upgrades.md) for detailed upgrade history and verification checklists.

### Added
- LanceDB-backed long-term memory provider for OpenCode.
- Hybrid retrieval (vector + BM25 lexical) with configurable weights.
- Auto-capture of durable outcomes from completed assistant responses.
- Project-scope memory isolation (`project:*` + optional `global`).
- Memory tools: `memory_search`, `memory_delete`, `memory_clear`, `memory_stats`.
- Sidecar-based configuration (`~/.config/opencode/lancedb-opencode-pro.json`) with environment variable overrides.
- Embedding compatibility validation and schema version tracking to prevent unsafe vector mixing.
- Scope pruning with configurable `maxEntriesPerScope`.
- Destructive operation safeguards: `memory_delete` and `memory_clear` require `confirm=true`.
- Foundation, regression, retrieval, and latency benchmark test suites.
- Docker Compose test environment with layered validation workflows (`npm run verify`, `npm run verify:full`).
- E2E memory persistence verification flow (write → restart → retrieve).
- OpenSpec specs: `memory-provider-config`, `memory-auto-capture-and-recall`, `memory-project-scope-isolation`, `memory-management-commands`, `memory-validation-harness`.
- Ollama embedding provider integration with timeout and connection resilience.
- `.tgz` distribution workflow for local plugin installation.
