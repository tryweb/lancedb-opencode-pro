## Context

The `lancedb-opencode-pro` plugin currently stores all memories scoped to `project:*`, derived from Git repository context. This design addresses the need for cross-project knowledge sharing by introducing a dual-scope architecture where certain memories can be promoted to `global` scope and automatically shared across all projects.

**Current State:**
- All memory entries are stored with `scope = "project:<repo-id>"`
- Recall queries are constrained to the active project scope
- No mechanism for knowledge that applies to multiple projects (e.g., "Alpine Linux find uses BusyBox")

**Constraints:**
- Must maintain backward compatibility with existing project-scoped behavior
- Must not pollute project recall with irrelevant global memories
- Must provide user control over scope decisions (promotion/demotion)

**Stakeholders:**
- OpenCode users working across multiple repositories
- Developers who want to share tool knowledge and workflow patterns

## Goals / Non-Goals

**Goals:**
- Enable cross-project memory sharing without manual copy-paste
- Automatically detect potential global knowledge during capture
- Provide clear user prompts for scope promotion/demotion decisions
- Keep project recall signal strong by discounting global scores

**Non-Goals:**
- Automatic memory deduplication across projects (out of scope)
- Automatic demotion without user confirmation (only suggestions)
- Global recall search without project context (always dual-scope)

## Decisions

### Decision 1: Dual-Scope Recall with Score Discount

**Choice:** Query both project and global scopes in parallel, merge results with global scores discounted by 0.7x.

**Rationale:**
- Ensures global knowledge is available when relevant
- Prevents global memories from drowning out project-specific context
- Allows users to understand which results came from global scope (via metadata)

**Alternatives Considered:**
- Query global only when project has no results → Rejected. Global knowledge should be available proactively.
- Always include global with equal weight → Rejected. Would dilute project recall signal.
- User-controlled global toggle → Adds friction. Automatic inclusion with discount is better default.

### Decision 2: Keyword-Based Global Detection

**Choice:** Use a predefined list of cross-project keywords (Linux distributions, Docker, Kubernetes, shells, cloud platforms) with a threshold of 2+ matches to trigger promotion prompt.

**Rationale:**
- Simple, predictable, and explainable
- Covers the most common cross-project knowledge types
- Avoids expensive LLM-based classification
- Threshold of 2 reduces false positives

**Alternatives Considered:**
- LLM-based semantic analysis → Rejected. Too expensive, adds latency, may be inconsistent.
- All memories global by default → Rejected. Would clutter global scope with project-specific noise.
- User manual tagging only → Rejected. Misses the automation goal.

**Keywords:**
```typescript
const GLOBAL_KEYWORDS = [
  // Distributions
  'alpine', 'debian', 'ubuntu', 'centos', 'fedora', 'arch',
  // Containers
  'docker', 'dockerfile', 'docker-compose', 'containerd',
  // Orchestration
  'kubernetes', 'k8s', 'helm', 'kubectl',
  // Shells/Systems
  'bash', 'shell', 'linux', 'unix', 'posix', 'busybox',
  // Web servers
  'nginx', 'apache', 'caddy',
  // Databases
  'postgres', 'postgresql', 'mysql', 'redis', 'mongodb', 'sqlite',
  // Cloud
  'aws', 'gcp', 'azure', 'digitalocean',
  // VCS
  'git', 'github', 'gitlab', 'bitbucket',
  // Protocols
  'api', 'rest', 'graphql', 'grpc', 'http', 'https',
  // Tools
  'npm', 'yarn', 'pnpm', 'pip', 'cargo', 'make', 'cmake',
];
```

### Decision 3: User Confirmation for Promotion

**Choice:** Prompt user for confirmation when heuristic detects global-worthy content, rather than automatically promoting.

**Rationale:**
- User context is required to determine if knowledge is truly cross-project
- Avoids polluting global scope with false positives
- Respects user agency over memory organization

**Alternatives Considered:**
- Automatic promotion → Rejected. Too risky for global scope pollution.
- No prompt, just label suggestion → Rejected. Misses the opportunity to confirm intent.

### Decision 4: Unused Global Memory Demotion

**Choice:** Track recall usage of global memories. After 30 days without recall, prompt user with demotion suggestions. User must confirm demotion.

**Rationale:**
- Prevents global scope from accumulating unused knowledge
- Gives user final say on scope changes
- Maintains global scope quality over time

**Alternatives Considered:**
- Automatic demotion → Rejected. Could remove genuinely useful memories that simply haven't been queried recently.
- No cleanup → Rejected. Global scope would grow unbounded.

### Decision 5: Scope Field Schema

**Choice:** Add `scope: "project" | "global"` field to `MemoryEntry` interface. Default is `"project"`.

**Rationale:**
- Minimal schema change
- Backward compatible (existing entries implicitly have `scope: "project"`)
- Easy to query and filter

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Global scope accumulates low-quality knowledge | User confirmation required; demotion flow available |
| Global recall dilutes project recall signal | Score discount (0.7x) keeps project results prioritized |
| Too many prompts annoy users | Only prompt when keyword threshold met; batch unused detection |
| User forgets to promote useful knowledge | Auto-detection acts as reminder; low friction to confirm |
| Global memories become stale | Demotion flow encourages periodic review |

## Migration Plan

### Phase 1: Schema and Storage
1. Add `scope` field to `MemoryEntry` with default `"project"`
2. Update LanceDB schema to include `scope` column
3. Add `readGlobalMemories()` method to store

### Phase 2: Dual-Scope Recall
1. Modify `search()` to accept scope filter
2. Implement parallel query of project + global
3. Implement score merge with global discount
4. Add `source` metadata to results (`"project"` or `"global"`)

### Phase 3: Detection and Promotion
1. Implement `detectGlobalWorthiness()` heuristic
2. Add promotion prompt in capture flow
3. Create `memory_scope_promote()` tool

### Phase 4: Demotion Flow
1. Track recall usage per global memory
2. Implement unused detection background task
3. Create demotion prompt and `memory_scope_demote()` tool

### Rollback Strategy
- Disable global inclusion via `includeGlobalScope: false` config
- Existing global memories remain but are excluded from recall

## Open Questions

1. **Should global memories be editable?** Currently memories are immutable. Extending to global scope may require edit capability.

2. **How to handle conflicting global vs project memories?** If a project has a memory about "use npm" but global says "avoid npm for large projects", which wins? Currently project wins due to score discount, but explicit conflict resolution may be needed.

3. **Should global memories have a separate retention policy?** Project memories are pruned at 3000 per scope. Should global have same or different limits?
