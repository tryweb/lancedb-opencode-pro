## Context

The target state is a long-term memory module for OpenCode inspired by `memory-lancedb-pro`, but adapted to OpenCode plugin contracts and lifecycle semantics. The project currently has no active specs or implementation files for memory behavior, so this change defines the first end-to-end contract from configuration to retrieval and operator management.

The user workflow requires:
- Transparent background capture after successful sessions.
- Fast recall of prior solutions during future incidents.
- Automatic memory boundary switching by active project directory/Git context.
- Operational control through search/delete/clear commands.

## Goals / Non-Goals

**Goals:**
- Define a v1 provider architecture for `lancedb-opencode-pro` with explicit configuration, storage, retrieval, and command boundaries.
- Ensure hybrid retrieval supports weighted vector/BM25 ranking and predictable defaults.
- Ensure project scope isolation prevents accidental cross-project recall.
- Define reliability guardrails for index drift, embedding model changes, and destructive command safety.

**Non-Goals:**
- Implementing production code in this change artifact.
- Building advanced reranking services beyond configurable extension points.
- Covering cloud-hosted multi-tenant memory synchronization.

## Decisions

### 1) Provider contract and installation
- Decision: Standardize provider identifier as `lancedb-opencode-pro` and distribution via global npm install.
- Rationale: Matches operator expectation and enables drop-in usage with `opencode.json` configuration.
- Alternative considered: local-only plugin wiring; rejected because it increases setup friction and weakens portability.

### 2) Configuration model
- Decision: Support `memory.provider`, `memory.dbPath`, `memory.embedding`, and `memory.retrieval` in `opencode.json`.
- Rationale: Keeps all memory controls in one stable namespace and aligns with user-provided configuration shape.
- Alternative considered: split provider settings across multiple top-level keys; rejected due to discoverability issues.

### 3) Capture and recall lifecycle
- Decision: Use OpenCode lifecycle hooks that correspond to end-of-turn/session output completion for auto-capture, and system/prompt injection stage for recall augmentation.
- Rationale: Recreates `agent_end` intent without requiring an identical hook name in OpenCode.
- Alternative considered: manual-only memory creation; rejected because it breaks the no-friction daily workflow.

### 4) Retrieval strategy
- Decision: Default retrieval mode to `hybrid` with configurable `vectorWeight` and `bm25Weight` (default 0.7 / 0.3).
- Rationale: Hybrid ranking handles both semantic similarity and exact token diagnostics (e.g., config keys, error strings).
- Alternative considered: vector-only retrieval; rejected because exact-match troubleshooting quality degrades.

### 5) Scope isolation model
- Decision: Derive project scope from Git/worktree identity and always filter retrieval by active scope plus optional global scope.
- Rationale: Supports seamless project switching and reduces accidental policy/config leakage across repos.
- Alternative considered: one global memory pool; rejected for safety and relevance reasons.

### 6) Command/management surface
- Decision: Provide `memory search`, `memory delete --id`, and `memory clear --scope` with confirmation guardrails for destructive actions.
- Rationale: Operators need explicit inspect/cleanup controls for memory hygiene.
- Alternative considered: search-only interface; rejected because no remediation path exists for stale memories.

### 7) Storage and compatibility guardrails
- Decision: Store memory records with schema version and embedding model metadata; enforce compatibility checks on startup/query.
- Rationale: Prevents silent quality regressions when embedding model changes or vector dimensions mismatch.
- Alternative considered: no version metadata; rejected because migration and diagnostics become brittle.

## Risks / Trade-offs

- [Hook behavior drift across OpenCode versions] -> Mitigation: isolate hook adapter layer and fail to manual mode with explicit warnings.
- [FTS/BM25 index drift after writes/deletes] -> Mitigation: stale-index detection and bounded rebuild strategy before BM25 queries.
- [Embedding model switched after data creation] -> Mitigation: track `embeddingModel` and `vectorDim`; block unsafe vector mixing and guide reindex flow.
- [Cross-project leakage] -> Mitigation: mandatory scope filter in retrieval path and destructive command scope validation.
- [Unbounded data growth] -> Mitigation: retention policy hooks and scope-level maintenance commands.
- [Destructive clear/delete misuse] -> Mitigation: confirmation requirement and explicit scope/id validation before execution.

## Migration Plan

1. Introduce provider configuration contract and validation with backward-compatible defaults.
2. Introduce memory schema with version metadata and first-run initialization under `~/.opencode/memory/lancedb`.
3. Introduce auto-capture and recall injection paths behind feature flags for staged rollout.
4. Introduce management commands (`search/delete/clear`) with audit-friendly outputs.
5. Add migration checks for embedding-model changes and index refresh requirements.
6. Rollback strategy: disable provider in config and preserve local DB files without destructive cleanup.

## Open Questions

- Which OpenCode hook combination should be treated as canonical replacement for `agent_end` for stable production capture?
- Should global scope recall be enabled by default, or opt-in only?
- What is the v1 retention policy (count-based, age-based, or hybrid) for long-running developer machines?
- Do we require a separate command for forced re-embedding/reindex in v1, or defer to v1.1?
