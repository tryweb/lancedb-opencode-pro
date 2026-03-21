## Context

The cross-project memory scope feature introduced global-scoped memories with tools for promotion/demotion. The `getUnusedGlobalMemories` method currently uses timestamp heuristics (older than threshold) to identify unused memories. This is imprecise — a recently stored memory might never be recalled, while an older one could be heavily used.

## Goals / Non-Goals

**Goals:**
- Track recall usage per memory (count, timestamp, projects)
- Use actual recall events for unused detection instead of timestamp
- Display usage statistics in `memory_global_list`

**Non-Goals:**
- Complex analytics or dashboards (out of scope)
- Automatic demotion without user confirmation (only suggestions)
- Cross-session session deduplication

## Decisions

### Decision 1: Usage Fields in MemoryRecord

**Choice:** Add `lastRecalled: number`, `recallCount: number`, and `projectCount: number` to `MemoryRecord`.

**Rationale:**
- Simple counters and timestamps are sufficient for the use case
- Avoids complex event storage or analytics overhead
- Directly queryable and displayable

### Decision 2: Update on Recall, Not on Search

**Choice:** Update usage stats when a memory is **returned** in recall results, not when the search query is made.

**Rationale:**
- Only memories that were actually useful to the user should count as "recalled"
- Avoids inflating counts for queries that matched but weren't used
- Aligns with the "useful" semantics

### Decision 3: ProjectCount Tracking

**Choice:** Track distinct project scopes that have recalled each global memory.

**Implementation:**
- Extract project scope from the session context during recall
- Maintain a `Set<string>` of project scopes per global memory
- Store as JSON in `metadataJson` or add a dedicated column

**Rationale:**
- Shows which projects are actually benefiting from global knowledge
- Helps identify "universal" vs "niche" global memories

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Adding fields increases schema complexity | Fields are simple types (number, number, number) |
| ProjectCount could grow unbounded | Cap at reasonable limit (e.g., 100 distinct projects) |
| Updates add latency to recall | Batch updates or async processing if needed |

## Open Questions

1. **Should recallCount include auto-recall, manual-recall, or both?** — Both. Both indicate the memory was useful.

2. **Should we track what query triggered the recall?** — Not in v1. Too much storage overhead.

3. **How to handle project scope changes?** — ProjectCount deduplicates by scope string. If user renames project, it appears as new.
