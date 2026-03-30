# Tasks: BL-046 — DB row runtime 型別驗證

## Implementation Tasks

- [x] **T1**: Add `zod` as a devDependency to `package.json`
  - Zod v4.1.8 already present in node_modules — no install needed

- [x] **T2**: Define Zod schemas for all JSON sub-fields in `src/types.ts`
  - `ValidationOutcomeSchema`, `SuccessPatternSchema`, `RetryAttemptSchema`, `RecoveryStrategySchema`
  - `EpisodicTaskRecordBaseSchema` validates DB row shape (JSON fields stay as strings)
  - Note: No `z.transform()` — JSON parsing stays at call sites to preserve DB write semantics

- [x] **T3**: Implement `validateEpisodicRecord()` and `validateEpisodicRecordArray()` in `src/types.ts`

- [x] **T4**: Replace 10 cast sites in `src/store.ts` with validated reads
  - All `as unknown as EpisodicTaskRecord` replaced with `validateEpisodicRecord()` / `validateEpisodicRecordArray()`
  - Write path (appendToEpisodeField) uses raw cast to preserve JSON string types

- [x] **T5**: Replace 2 cast sites in `src/index.ts` with validated reads
  - All JSON.parse calls updated to use validated record fields

- [x] **T6**: Add unit tests `tests/unit/validate-episodic-record.test.ts`
  - Tests for R1–R5 (valid record, invalid state, malformed JSON, array validation)

- [x] **T7**: Run existing tests to confirm no regression
  - `npm run test:effectiveness`: 32/32 pass ✅
  - `episodic-task.test.ts`: 14/14 pass ✅

- [x] **T8**: Run `npm run typecheck` to confirm TypeScript compilation succeeds

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

- Validation only covers top-level field types (string, number, enum, optional/null). JSON sub-field parsing stays at call sites to avoid write-path corruption.
- Write path (appendToEpisodeField) uses raw cast `rows[0] as unknown as EpisodicTaskRecord` to preserve JSON string types for serialization.
- `ZodError` thrown on corrupt data — fail-fast is correct behavior for DB row validation.
