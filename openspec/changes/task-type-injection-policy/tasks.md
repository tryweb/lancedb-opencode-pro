# Tasks: Task-Type Aware Injection Policy

## Implementation Tasks

- [ ] **T1**: Add TaskType and InjectionProfile types in `src/types.ts`
  - Location: `src/types.ts`
  - Add: `TaskType = "coding" | "documentation" | "review" | "release" | "general"`
  - Add: `InjectionProfile` interface

- [ ] **T2**: Add default task-type profiles in `src/config.ts`
  - Location: `src/config.ts` `resolveInjectionConfig()`
  - Define default profiles for each TaskType
  - Parse env vars: `LANCEDB_OPENCODE_PRO_INJECTION_CODING_MAX_MEMORIES` etc.

- [ ] **T3**: Add task type detection function in `src/index.ts`
  - Location: `src/index.ts` new function `detectTaskType(query: string): TaskType`
  - Detect from query keywords
  - Default to "general" when no match

- [ ] **T4**: Add category weighting function in `src/index.ts`
  - Location: `src/index.ts` new function `getCategoryWeights(taskType: TaskType)`
  - Return category weights based on task type

- [ ] **T5**: Apply task-type profiles in injection flow
  - Location: `src/index.ts` in system.transform hook
  - Detect task type before search
  - Apply profile in search params (category weights)
  - Use profile for summarization config

## Testing Tasks

- [ ] **T6**: Add unit tests for task type detection
  - Location: `test/unit/task-type.test.ts` (new file)
  - Test keyword detection for each task type
  - Test default fallback

- [ ] **T7**: Add unit tests for category weighting
  - Location: `test/unit/task-type.test.ts`
  - Test weights for each task type

- [ ] **T8**: Add integration test for task-type injection
  - Location: `test/regression/plugin.test.ts`
  - Test different task types produce different injection behavior

- [ ] **T9**: Add e2e test for task-type injection
  - Location: `scripts/e2e-opencode-memory.mjs`
  - End-to-end test: query with different task types

## Verification Matrix

| Requirement | Unit | Integration | E2E | Required |
|-------------|------|------------|-----|----------|
| Task type detection | T6 | T8 | - | yes |
| Injection profiles | T6 | T8 | - | yes |
| Category weighting | T7 | T8 | - | yes |
| Configuration | T7 | - | - | yes |
| Backward compatibility | T6 | T8 | T9 | yes |

## Pre-Implementation Gate

Before starting T1-T5:
- [ ] Verify OpenSpec status shows change ready
- [ ] Review `src/types.ts` current InjectionConfig structure
- [ ] Review `src/index.ts` recall flow to find injection entry points
- [ ] Confirm no existing TaskType concept

## Definition of Done

1. All tasks T1-T9 completed
2. `npm run build` passes
3. `npm run test` passes (all unit tests)
4. Docker verification passes
5. Feature branch pushed with all changes
