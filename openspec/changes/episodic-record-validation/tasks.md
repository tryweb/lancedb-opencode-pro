# Tasks: BL-046 — DB row runtime 型別驗證

## Implementation Tasks

- [ ] **T1**: Add `zod` as a devDependency to `package.json`
  - `npm install --save-dev zod`
  - Update `package.json` devDependencies

- [ ] **T2**: Define Zod schemas for all JSON sub-fields in `src/types.ts`
  - `ValidationOutcomeSchema`
  - `SuccessPatternSchema`  
  - `RetryAttemptSchema`
  - `RecoveryStrategySchema`
  - `EpisodicTaskRecordSchema` (using `z.transform()` for JSON string fields)

- [ ] **T3**: Implement `validateEpisodicRecord()` and `validateEpisodicRecordArray()` in `src/types.ts`

- [ ] **T4**: Replace 11 cast sites in `src/store.ts` with validated reads
  - Line ~880: `updateTaskState` → `validateEpisodicRecord(rows[0])`
  - Line ~900: `getTaskEpisode` → `validateEpisodicRecord(rows[0])`
  - Line ~914: `queryTaskEpisodes` → `validateEpisodicRecordArray(rows)`
  - Line ~923: `addCommandToEpisode` → `validateEpisodicRecord(rows[0])`
  - Line ~942: `addValidationOutcome` → `validateEpisodicRecord(rows[0])`
  - Line ~961: `addSuccessPatterns` → `validateEpisodicRecord(rows[0])`
  - Line ~983: `findSimilarTasks` → `validateEpisodicRecordArray(rows)`
  - Line ~1028: `queryTaskEpisodes` → `validateEpisodicRecordArray(rows)`
  - Line ~1075: `addRetryAttempt` → `validateEpisodicRecord(rows[0])`
  - Line ~1097: `addRecoveryStrategy` → `validateEpisodicRecord(rows[0])`
  - Line ~1117: `suggestRetryBudget` → `validateEpisodicRecordArray(rows)`
  - Line ~1163: `suggestRecoveryStrategies` → `validateEpisodicRecordArray(failedRows)`
  - Line ~1166: `suggestRecoveryStrategies` → `validateEpisodicRecordArray(successRows)`

- [ ] **T5**: Replace 2 cast sites in `src/index.ts` with validated reads
  - `task_episode_query` handler
  - `find_similar_tasks` handler

- [ ] **T6**: Add unit tests `tests/unit/validate-episodic-record.test.ts`
  - Test R1: valid record passes
  - Test R2: invalid `state` throws with descriptive error
  - Test R3: malformed `commandsJson` throws
  - Test R4: empty `metadataJson` throws
  - Test R5: array validation works

- [ ] **T7**: Run existing tests to confirm no regression
  - `npm run test:effectiveness` (foundation + regression)
  - All tests pass

- [ ] **T8**: Run `npm run typecheck` to confirm TypeScript compilation succeeds

## Verification Matrix

| Requirement | Unit | Integration | E2E | Required |
|-------------|------|------------|-----|----------|
| R1: Valid record passes | ✅ | ✅ | n/a | yes |
| R2: Invalid state throws | ✅ | n/a | n/a | yes |
| R3: Malformed JSON throws | ✅ | n/a | n/a | yes |
| R4: All 13 cast sites replaced | ✅ (grep) | ✅ | n/a | yes |
| R5: Validator tested | ✅ | n/a | n/a | yes |
| R6: No regression | n/a | ✅ | n/a | yes |

## Changelog Wording Class

**`internal-only`** — Runtime safety hardening, no user-facing feature change.

## Dependencies

- **BL-043**: The DRY refactor (BL-043) can be done before or after BL-046; they are independent. BL-046 validates the reads that BL-043's helper will make.

## Notes

- `ZodError` is thrown on validation failure — callers that currently return `false` for "not found" will now throw on "found but invalid". This is intentional: `false` means "record not found", but corrupt data is a different failure mode.
- The `transform()` on JSON string fields means the returned `EpisodicTaskRecord` has parsed objects for JSON fields, not strings. Callers that do `JSON.parse(existing.commandsJson)` will need updating — but all callers already do this, and after BL-043's helper refactor, this is handled centrally.
