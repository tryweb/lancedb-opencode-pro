# Spec: Tool Registration Modularization

> **Change ID**: bl-041-tool-registration-modularization  
> **Runtime Surface**: internal-api  
> **Entrypoint**: `src/tools/*.ts`, `src/index.ts` re-exports

---

## Requirement: Tool Definitions Preserved

The system SHALL preserve all existing tool definitions with identical names, descriptions, and schemas.

Runtime Surface: internal-api  
Entrypoint: `src/tools/memory.ts`, `src/tools/feedback.ts`, `src/tools/episodic.ts`

### Scenario: All memory tools exist
- WHEN the plugin is loaded
- THEN all memory-related tools are registered:
  - memory_search, memory_delete, memory_clear, memory_stats
  - memory_remember, memory_forget
  - memory_citation, memory_validate_citation
  - memory_what_did_you_learn, memory_why, memory_explain_recall
  - memory_scope_promote, memory_scope_demote, memory_global_list
  - memory_consolidate, memory_consolidate_all
  - memory_port_plan
  - memory_dashboard, memory_kpi

### Scenario: All feedback tools exist
- WHEN the plugin is loaded
- THEN all feedback tools are registered:
  - memory_feedback_missing
  - memory_feedback_wrong
  - memory_feedback_useful
  - memory_effectiveness

### Scenario: All episodic tools exist
- WHEN the plugin is loaded
- THEN all episodic/task tools are registered:
  - task_episode_create
  - task_episode_query
  - similar_task_recall
  - retry_budget_suggest
  - recovery_strategy_suggest

---

## Requirement: Tool Schemas Unchanged

The system SHALL maintain identical tool argument schemas after modularization.

Runtime Surface: internal-api  
Entrypoint: `src/tools/*.ts`

### Scenario: Schema compatibility
- GIVEN existing tool definitions in production
- WHEN comparing old and new tool schemas
- THEN all tool.name, tool.description, and tool.args are identical

---

## Requirement: Tool Execution Works

The system SHALL execute tool functions with the same behavior as before refactoring.

Runtime Surface: internal-api  
Entrypoint: `src/tools/*.ts` execute functions

### Scenario: Tool execution with state
- GIVEN initialized plugin state
- WHEN executing a tool (e.g., memory_search)
- THEN the tool executes successfully and returns expected output format

### Scenario: Tool handles uninitialized state
- GIVEN uninitialized plugin state
- WHEN executing a tool
- THEN the tool returns the unavailable message

---

## Requirement: Module Structure Valid

The system SHALL have tools organized in domain-specific modules.

Runtime Surface: internal-api  
Entrypoint: `src/tools/index.ts` re-exports

### Scenario: Module exports exist
- WHEN importing from `src/tools/`
- THEN all tools are exported from appropriate modules
- AND all tools are re-exported from `src/tools/index.ts`

### Scenario: Import paths work
- WHEN TypeScript compiles the project
- THEN all import paths resolve correctly
- AND no circular dependency errors

---

## Observability

### Inspection Points
- TypeScript compilation success/failure
- Plugin load success/failure
- All 26 tools registered in plugin hooks

---

## Verification Matrix

| Requirement | Unit | Integration | E2E | Required to release |
|---|---|---|---|---|
| Tool definitions preserved | ✅ | ✅ | n/a | yes |
| Tool schemas unchanged | ✅ | n/a | n/a | yes |
| Tool execution works | ✅ | ✅ | n/a | yes |
| Module structure valid | ✅ | n/a | n/a | yes |
