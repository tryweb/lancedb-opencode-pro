# Changelog

All notable changes to this project will be documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/). Versions follow [Semantic Versioning](https://semver.org/).

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

## [0.1.0] - 2026-03-16

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
