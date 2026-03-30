# Tasks: BL-043 — Episodic 更新流程 DRY 化

## Implementation Tasks

- [x] **T1**: Implement `appendToEpisodeField<T>()` private generic helper in `src/store.ts`
  - Signature: `appendToEpisodeField<T>(taskId, scope, fieldAccessor, fieldMutator, parser, serializer, newItem, itemEnricher?): Promise<boolean>`
  - Must handle empty/null field values gracefully via `parser(raw || '[]')`
  - Must add timestamp enrichment for `retryAttempts` and `recoveryStrategies` items

- [x] **T2**: Refactor `addCommandToEpisode()` to delegate to helper (reduce from ~15 lines to ~8)
  - Verify existing tests pass without modification

- [x] **T3**: Refactor `addValidationOutcome()` to delegate to helper

- [x] **T4**: Refactor `addSuccessPatterns()` to delegate to helper
  - Note: `addSuccessPatterns` has array-merge semantics (not single-item push), so it retains inline implementation for correctness

- [x] **T5**: Refactor `addRetryAttempt()` to delegate to helper (with `itemEnricher` that adds `timestamp`)

- [x] **T6**: Refactor `addRecoveryStrategy()` to delegate to helper (with `itemEnricher` that adds `attemptedAt`)

- [x] **T7**: Run existing episodic integration tests to confirm no behavioral regression
  - `npm run test:effectiveness` — 63/63 tests pass (31 foundation + 32 regression)
  - No behavioral regression detected

## Verification Matrix

| Requirement | Unit | Integration | E2E | Required |
|-------------|------|------------|-----|----------|
| R1: Behavioral equivalence | ✅ | ✅ | n/a | yes |
| R2: Signature preservation | ✅ (compile check) | ✅ (existing tests) | n/a | yes |
| R3: Empty field handling | ✅ | ✅ | n/a | yes |
| R4: All 5 fields covered | ✅ | ✅ | n/a | yes |

## Changelog Wording Class

**`internal-only`** — This is a pure refactor with no user-visible behavior change.

## Notes

- All 5 methods currently use `escapeSql()` for SQL injection prevention — this is preserved in the helper
- The delete-then-add write protocol (not an upsert) is preserved — this is an existing design constraint, not a bug
- If JSON parsing throws on malformed data, the error propagates (same as before — not suppressed)
