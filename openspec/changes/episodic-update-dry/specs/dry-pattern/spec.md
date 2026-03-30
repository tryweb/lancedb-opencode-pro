# Spec: BL-043 — Episodic 更新流程 DRY 化

## Requirement: R1 — Behavioral Equivalence After Refactor

The refactored `addCommandToEpisode`, `addValidationOutcome`, `addSuccessPatterns`, `addRetryAttempt`, and `addRecoveryStrategy` methods SHALL produce identical database state as the original implementations for equivalent inputs.

**Runtime Surface**: `internal-api`
**Entrypoint**: `src/store.ts` → private `appendToEpisodeField<T>()` helper

### Scenario: addCommandToEpisode — single command append

- **WHEN**: `addCommandToEpisode("task-abc", "project-x", "git commit -m 'fix'")` is called on an existing episode record with `commandsJson = "[]"`
- **THEN**: The episode record's `commandsJson` field is updated to `["git commit -m 'fix'"]` and the method returns `true`
- **AND**: The record's other fields (state, scope, taskId, etc.) remain unchanged

### Scenario: addValidationOutcome — multiple outcomes accumulate

- **WHEN**: `addValidationOutcome` is called twice on the same record with different outcomes
- **THEN**: Both outcomes are present in the `validationOutcomesJson` array, preserving insertion order
- **AND**: The array grows by exactly one item per call

### Scenario: Record not found

- **WHEN**: `addXxxEpisode` is called with a `taskId + scope` combination that does not exist
- **THEN**: The method returns `false` and makes no database modifications

### Scenario: addRetryAttempt — enriched with timestamp

- **WHEN**: `addRetryAttempt` is called with `{ attemptNumber: 2, outcome: "failed", errorMessage: "timeout" }`
- **THEN**: The stored retry attempt object includes `timestamp: <Date.now()>` (added by the helper)
- **AND**: The `retryAttemptsJson` array grows by one item

## Requirement: R2 — No Breaking API Changes

All 5 refactored methods SHALL maintain identical method signatures and return types as before the refactor.

**Runtime Surface**: `internal-api`
**Entrypoint**: `src/store.ts` → all 5 public `add*Episode` methods

### Scenario: Signature preservation

- **WHEN**: Any caller (existing tests, tool handlers) invokes `addCommandToEpisode(taskId: string, scope: string, command: string): Promise<boolean>`
- **THEN**: The refactored implementation accepts the same arguments and returns `Promise<boolean>`
- **AND**: No new required parameters are introduced

## Requirement: R3 — Helper Handles Empty Initial Field Gracefully

When the target JSON field is `null`, `undefined`, or an empty string, the helper SHALL initialize the array from an empty array and proceed normally.

**Runtime Surface**: `internal-api`
**Entrypoint**: `src/store.ts` → `appendToEpisodeField<T>()` → `parser(raw)` call

### Scenario: Empty commandsJson on new record

- **WHEN**: A record exists but `commandsJson` is `""` or missing
- **THEN**: `parser("")` returns `[]` and the first append succeeds with a single-item array

### Scenario: Malformed JSON in field

- **WHEN**: The stored `commandsJson` contains `"{not valid json"`
- **THEN**: `JSON.parse` throws a `SyntaxError` (existing behavior, not suppressed)
- **AND**: The error propagates to the caller

## Requirement: R4 — Template Covers All Five JSON Fields

The helper template SHALL be parameterized to handle all 5 episodic JSON fields:

| Field | Type | Parser | Serializer |
|-------|------|--------|------------|
| `commandsJson` | `string[]` | `raw => JSON.parse(raw || '[]')` | `arr => JSON.stringify(arr)` |
| `validationOutcomesJson` | `ValidationOutcome[]` | `raw => JSON.parse(raw || '[]')` | `arr => JSON.stringify(arr)` |
| `successPatternsJson` | `SuccessPattern[]` | `raw => JSON.parse(raw || '[]')` | `arr => JSON.stringify(arr)` |
| `retryAttemptsJson` | `RetryAttempt[]` | `raw => JSON.parse(raw || '[]')` | `arr => JSON.stringify(arr)` |
| `recoveryStrategiesJson` | `RecoveryStrategy[]` | `raw => JSON.parse(raw || '[]')` | `arr => JSON.stringify(arr)` |

### Scenario: All five fields appendable via helper

- **WHEN**: Each of the 5 methods is called and the helper is invoked
- **THEN**: Each field accessor/mutator pair correctly reads and writes the correct JSON field
- **AND**: No field cross-contamination (commands don't appear in validationOutcomes, etc.)
