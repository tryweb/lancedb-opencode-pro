## Why

Currently all long-term memories in `lancedb-opencode-pro` are scoped to `project:*` only. Knowledge types like tool limitations (e.g., "Alpine Linux find uses BusyBox, does not support -empty"), workflow patterns, and platform-specific insights should be shared across projects to avoid re-learning. However, there is no mechanism to automatically detect and promote cross-project knowledge.

## What Changes

### New Capabilities

1. **Memory scope field** — Every memory entry gains a `scope` field (`"project"` or `"global"`). Default is `"project"`.

2. **Global detection heuristic** — When storing a memory, the system analyzes content against known cross-project keywords (Linux distributions, Docker, Kubernetes, shells, cloud platforms, common services). If threshold is met, prompt user to confirm promotion.

3. **Scope promotion flow** — New tool `memory_scope_promote` that allows users to promote project-scoped memories to global, or confirm auto-detected promotions.

4. **Dual-scope recall** — When `memory_search` executes, it queries both the active project scope and the global scope in parallel, then merges results with global scores discounted by 0.7x to avoid drowning project-specific context.

5. **Unused global detection** — Background analysis periodically checks global memories. If a global memory has not been recalled in the past 30 days, prompt user with demotion suggestions.

6. **Scope management tools** — New tools for viewing and managing global memories: `memory_global_list`, `memory_scope_promote`, `memory_scope_demote`.

## Capabilities

### New Capabilities

- `memory-scope-field`: Add `scope` metadata field to memory entries with values `"project"` or `"global"`.
- `memory-global-detection`: Heuristic analysis of memory content to detect cross-project worthy knowledge based on keyword matching.
- `memory-scope-promotion`: Promotion flow with user confirmation for detected global candidates and manual promotion tool.
- `memory-scope-demotion`: Demotion flow for unused global memories with user confirmation.
- `memory-dual-scope-recall`: Parallel query of project + global scopes with score merge and global discount.
- `memory-global-list`: Tool to view and search all global-scoped memories.

### Modified Capabilities

- `memory-management-commands`: Add `memory_scope_promote`, `memory_scope_demote`, and `memory_global_list` tools to the existing command set.

## Impact

### Code Changes

- `src/types.ts`: Add `scope` field to `MemoryEntry` interface
- `src/store.ts`: Modify `search()` to support dual-scope query with merge; add `getGlobalMemories()` method
- `src/index.ts`: Add new tools (`memory_scope_promote`, `memory_scope_demote`, `memory_global_list`); add heuristic detection in capture flow
- `src/extract.ts`: Pass scope metadata during memory storage

### Configuration Changes

- New config: `includeGlobalScope` (default: `true`)
- New config: `global_detection_threshold` (default: `2` keywords)
- New config: `global_discount_factor` (default: `0.7`)
- New config: `unused_days_threshold` (default: `30` days)

### Behavior Changes

- `memory_search` now queries both project and global scopes (if `includeGlobalScope: true`)
- Global memories appear with `source: "global"` metadata to distinguish from project memories
- Users are prompted when storing memories that may be globally relevant
- Users are periodically notified about unused global memories

### Breaking Changes

- None. All changes are additive. Existing project-scoped behavior is preserved by default.
