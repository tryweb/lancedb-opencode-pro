# Design: BL-041 Tool Registration Modularization

> **Backlog ID**: BL-041  
> **Runtime Surface**: internal-api (code refactoring)

---

## Decision Table

| Decision | Choice | Why | Trade-off |
|---|---|---|---|
| Directory structure | `src/tools/` with domain-based files | Aligns with proposed split: memory/feedback/episodic | Requires updating imports across the codebase |
| Tool grouping | By functional domain | memory: search, stats, remember, forget, citation, etc.<br>feedback: missing, wrong, useful<br>episodic: task_episode_*, similar_task_recall, retry/recovery | Some tools span domains - will colocate by primary purpose |
| Export strategy | Factory functions returning tool definitions | Allows state injection while keeping tool definitions modular | Slight indirection vs direct export |
| Backward compatibility | Re-export all tools from index.ts | Existing integration points remain unchanged | index.ts remains as thin facade |

---

## Architecture

```
src/
  index.ts           # Plugin entry, hooks, state management
  tools/
    memory.ts        # Tool definitions: search, stats, remember, forget, citation, etc.
    feedback.ts      # Tool definitions: feedback_missing, feedback_wrong, feedback_useful, etc.
    episodic.ts      # Tool definitions: task_episode_*, similar_task_recall, retry/recovery
    index.ts         # Re-exports all tools for compatibility
```

### Tool Groupings

**memory.ts** - Memory management tools:
- memory_search, memory_delete, memory_clear, memory_stats
- memory_remember, memory_forget
- memory_citation, memory_validate_citation
- memory_what_did_you_learn, memory_why, memory_explain_recall
- memory_scope_promote, memory_scope_demote, memory_global_list
- memory_consolidate, memory_consolidate_all
- memory_port_plan
- memory_dashboard, memory_kpi

**feedback.ts** - Feedback-related tools:
- memory_feedback_missing
- memory_feedback_wrong
- memory_feedback_useful
- memory_effectiveness

**episodic.ts** - Task/episode learning tools:
- task_episode_create
- task_episode_query
- similar_task_recall
- retry_budget_suggest
- recovery_strategy_suggest

---

## Operability

### Trigger Path
- This is an internal refactoring; no runtime behavior changes
- All existing tool names and schemas remain identical

### Expected Behavior
- All 26 tools should function identically before and after refactoring
- No changes to hook wiring, config, or runtime state

### Misconfiguration Behavior
- If imports are broken, TypeScript compilation will fail
- If tool exports are missing, runtime will fail to register tools

---

## Verification

### Unit Tests
- Each tool file should have unit tests for tool definitions
- Verify tool names, descriptions, and schemas are preserved

### Integration Tests
- Plugin loads and registers all tools successfully
- All tool execute functions work with mock state

### E2E
- Not required (internal-only refactoring)
