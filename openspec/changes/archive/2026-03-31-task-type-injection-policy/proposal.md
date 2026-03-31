# Proposal: Task-Type Aware Injection Policy

## Backlog Item

- **ID**: BL-039
- **Title**: Task-type aware injection policy
- **Priority**: P0

## Problem Statement

Currently, memory injection uses a **one-size-fits-all** approach:
- Same `maxMemories`, `budgetTokens`, and `summaryTargetChars` regardless of task type
- Same memory categories are prioritized for all tasks

However, different task types have different memory needs:
- **Coding tasks**: Need technical decisions, patterns, error solutions
- **Documentation tasks**: Need requirements, decisions, past explanations
- **Code review tasks**: Need coding standards, patterns, conventions
- **Release tasks**: Need deployment patterns, configuration decisions

## Why Now

1. **BL-038 completed**: Feedback-driven ranking provides foundation for adaptive retrieval
2. **Complementary to BL-038**: Task-type awareness builds on feedback mechanism
3. **Immediate value**: Users doing different task types get more relevant memories

## Scope

### In Scope
- Task type detection from session context
- Task-type specific injection profiles (maxMemories, budgetTokens, categories)
- Configuration for task-type profiles
- Memory category weighting per task type
- Fallback to default config when task type unknown

### Out of Scope
- Learning/adaptation based on success (future work)
- Multiple concurrent task types (future work)
- User-defined custom profiles (future work)

## Impacted Modules

| Module | Changes |
|--------|---------|
| `src/types.ts` | Add TaskType, InjectionProfile types |
| `src/config.ts` | Add task-type injection profiles configuration |
| `src/summarize.ts` | Modify injection limit calculation |
| `src/index.ts` | Detect task type and apply profiles |

## Release Impact

- **Type**: Internal-only feature (plugin enhancement)
- **Changelog class**: `internal-only` - not exposed as separate user tool

## Risks

1. **Task type detection**: May not always correctly identify task type
2. **Cold start**: New profiles may need tuning
3. **Performance**: Slight overhead in task type detection

## Acceptance Criteria

1. Task type is detected from session context (or defaults to "general")
2. Each task type has configurable injection profile
3. Memory categories can be weighted per task type
4. Fallback to default when task type unknown
5. Improvement measurable via existing KPI tools
