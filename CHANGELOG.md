# Changelog

All notable changes to this project will be documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/). Versions follow [Semantic Versioning](https://semver.org/).

---

## [0.2.2] - 2026-03-21

### Changed

- Upgraded `@lancedb/lancedb` from `0.26.2` to `0.27.1` for improved hybrid search pre-filtering and native binding compatibility (napi-rs v3).

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
