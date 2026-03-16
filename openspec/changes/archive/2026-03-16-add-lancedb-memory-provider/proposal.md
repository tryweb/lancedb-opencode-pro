## Why

OpenCode currently lacks durable long-term memory across sessions and projects, which causes repeated troubleshooting and lost architectural decisions. We need a LanceDB-backed memory provider that supports automatic capture, scoped retrieval, and operator controls while remaining installable as a global npm package.

## What Changes

- Add a new memory provider package contract named `lancedb-opencode-pro` for OpenCode memory integration.
- Add configurable memory settings in `opencode.json`, including `dbPath`, embedding provider/model, and hybrid retrieval weights.
- Add automatic memory capture behavior for successful decisions and runbook-like outcomes at conversation end lifecycle points.
- Add hybrid retrieval (vector + BM25) for context injection during future troubleshooting.
- Add project-scope isolation based on Git context so memory follows the active repository context.
- Add memory management commands for search, targeted deletion, and scope-level clearing.

## Capabilities

### New Capabilities
- `memory-provider-config`: Define and validate memory provider configuration for LanceDB path, embedding backend, and retrieval strategy.
- `memory-auto-capture-and-recall`: Capture durable memories automatically and retrieve them with hybrid ranking for context injection.
- `memory-project-scope-isolation`: Isolate and switch memories by project scope derived from Git/worktree identity.
- `memory-management-commands`: Provide memory search/delete/clear operations for operators.

### Modified Capabilities
- (none)

## Impact

- Affected systems: OpenCode plugin lifecycle hooks, memory provider interface, retrieval pipeline, and command/tool surface.
- External dependencies: LanceDB runtime, embedding backend integration (initially ollama-compatible), and optional rerank/FTS support.
- Operational concerns: local data growth, index maintenance, embedding model changes, and scope isolation safety.
- Distribution: package must support global install path via `npm install -g lancedb-opencode-pro`.
