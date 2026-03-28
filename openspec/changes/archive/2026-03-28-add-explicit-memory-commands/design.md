## Context

The current memory system relies entirely on automatic capture and retrieval. Users have no explicit control over what memories are stored, how they're used, or the ability to correct misunderstandings. The backlog identifies BL-010, BL-011, BL-012 as the first set of user-facing commands that give users explicit memory management capabilities.

## Goals / Non-Goals

**Goals:**
- Implement `/remember` command for explicit memory capture with optional labels
- Implement `/forget` command for memory removal (soft-delete and hard-delete options)
- Implement `/what-did-you-learn` command for viewing recent memory summaries
- Integrate all commands with existing effectiveness tracking

**Non-Goals:**
- Multi-user identity management (deferred to BL-034)
- Preference learning (separate change)
- Episodic task recording (separate change)

## Decisions

### Decision: Command Interface
Use tool-based interface matching existing `memory_search`, `memory_delete` patterns rather than slash commands.

**Rationale:** Consistent with OpenCode tool calling convention, easier to test, better structured output.

### Decision: Soft-Delete Default
`/forget` defaults to soft-delete (marks memory as disabled) rather than hard-delete.

**Rationale:** Preserves audit trail, enables recovery, maintains effectiveness event integrity. Hard-delete available via explicit flag.

### Decision: Summary Format
`/what-did-you-learn` returns categorized summaries rather than raw memory list.

**Rationale:** More actionable for users, reduces context overhead, enables future preference inference from summaries.

## Risks / Trade-offs

- [Risk] User confusion between auto-capture and explicit remember → **Mitigation**: Document difference, consider distinct storage flag
- [Risk] Memory bloat from excessive explicit captures → **Mitigation**: Apply same minChar threshold as auto-capture
- [Risk] Effectiveness metrics double-counting → **Mitigation**: Use distinct event source type for explicit vs auto operations
