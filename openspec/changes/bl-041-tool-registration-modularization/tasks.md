# Tasks: BL-041 Tool Registration Modularization

> **Change ID**: bl-041-tool-registration-modularization

---

## Implementation Tasks

### Phase 1: Create tool module directory structure

- [x] Create `src/tools/` directory
- [x] Create `src/tools/index.ts` for re-exports

### Phase 2: Extract memory tools

- [x] Create `src/tools/memory.ts`
- [x] Move memory_search tool definition to memory.ts
- [x] Move memory_delete tool definition to memory.ts
- [x] Move memory_clear tool definition to memory.ts
- [x] Move memory_stats tool definition to memory.ts
- [x] Move memory_remember tool definition to memory.ts
- [x] Move memory_forget tool definition to memory.ts
- [x] Move memory_citation tool definition to memory.ts
- [x] Move memory_validate_citation tool definition to memory.ts
- [x] Move memory_what_did_you_learn tool definition to memory.ts
- [x] Move memory_why tool definition to memory.ts
- [x] Move memory_explain_recall tool definition to memory.ts
- [x] Move memory_scope_promote tool definition to memory.ts
- [x] Move memory_scope_demote tool definition to memory.ts
- [x] Move memory_global_list tool definition to memory.ts
- [x] Move memory_consolidate tool definition to memory.ts
- [x] Move memory_consolidate_all tool definition to memory.ts
- [x] Move memory_port_plan tool definition to memory.ts
- [x] Move memory_dashboard tool definition to memory.ts
- [x] Move memory_kpi tool definition to memory.ts

### Phase 3: Extract feedback tools

- [x] Create `src/tools/feedback.ts`
- [x] Move memory_feedback_missing tool definition to feedback.ts
- [x] Move memory_feedback_wrong tool definition to feedback.ts
- [x] Move memory_feedback_useful tool definition to feedback.ts
- [x] Move memory_effectiveness tool definition to feedback.ts

### Phase 4: Extract episodic tools

- [x] Create `src/tools/episodic.ts`
- [x] Move task_episode_create tool definition to episodic.ts
- [x] Move task_episode_query tool definition to episodic.ts
- [x] Move similar_task_recall tool definition to episodic.ts
- [x] Move retry_budget_suggest tool definition to episodic.ts
- [x] Move recovery_strategy_suggest tool definition to episodic.ts

### Phase 5: Update index.ts imports and hooks

- [x] Update `src/index.ts` imports to use new tool modules
- [x] Wire up all tools from new modules in hooks.tool
- [x] Verify TypeScript compilation succeeds

### Phase 6: Verification

- [ ] Add unit tests for tool definitions in each module
- [ ] Add integration test to verify all 26 tools register successfully
- [ ] Run existing test suite to ensure no regressions
- [ ] Verify plugin loads correctly in test environment

---

## Verification Matrix

| Requirement | Unit | Integration | E2E | Required to release |
|---|---|---|---|---|
| Tool definitions preserved | ✅ | ✅ | n/a | yes |
| Tool schemas unchanged | ✅ | n/a | n/a | yes |
| Tool execution works | ✅ | ✅ | n/a | yes |
| Module structure valid | ✅ | n/a | n/a | yes |
